'''
v2_0 [Unet ] - easyOCR
SGF용 PDLC Droplet 형상 분석 프로그램_경량화
PDLC Droplet Image Analysis for SGF
'''
import os
import sys
import re
import time
import math
import warnings
from pathlib import Path
from functools import wraps

import numpy as np
import pandas as pd
import cv2
from scipy import ndimage


import torch
import tensorflow as tf
from easyocr import Reader

try:
  
  sys.path.append('./Utils/Models')
  from Utils.Models.model_Unet import unet
  
  sys.path.append("./Utils/Detection_v5")
  from Utils.Detection_v5.models.common import DetectMultiBackend
  from Utils.Detection_v5.utils.dataloaders import LoadImages
  from Utils.Detection_v5.utils.general import check_img_size, cv2, non_max_suppression, scale_coords, xyxy2xywh
  from Utils.Detection_v5.utils.torch_utils import select_device, time_sync 
  
except Exception as e:
  print("import error 1:", e)
  sys.exit()
  
warnings.filterwarnings(action="ignore")

# import만 변경, 밑에는 sam이랑 동일, unet으로 바꾸기!
##################################################################################################################


def timeit(func):
  @wraps(func)
  def timeit_wrapper(*args, **kwargs):
    start_time = time.perf_counter()
    result = func(*args, **kwargs)
    end_time = time.perf_counter()
    total_time = end_time - start_time
    print(f">>{func.name:>25s}(){total_time:>8.4f} s")
    return result
    
  return timeit_wrapper 


##################################################################################################################

# global function

def get_vector_angle (v1, v2) :

  dot_v = np.dot(v1, v2)
  ang_v = math.acos(dot_v/(np.linalg.norm(v1) * np.linalg.norm(v2)))*180/math.pi
  sign = (v1[0]*v2[1] - v1[1]*v2[0])/(np.linalg.norm(v1) * np.linalg.norm(v2)) > 0
  if sign :
    ang_v = 360- ang_v 
  
  return ang_v 
    
def Noise_rm(im, thr):
  label_objects_ed, nb_labels_ed = ndimage.label(im)
  sizes_ed = np.bincount(label_objects_ed.ravel())
  mask_sizes_ed = sizes_ed > thr
  mask_sizes_ed[0] = 0
  im_cleaned = 255 * mask_sizes_ed[label_objects_ed].astype('uint8')
  return im_cleaned
  
##################################################################################################################

# Scale ROI Class
class SEMROI():
  @timeit
  def init(self, fname, model_roi):

    self.fname = fname
    self.img_raw_c = cv2.imread(self.fname)
    self.img_raw_gray = cv2.cvtColor(self.img_raw_c, cv2.COLOR_BGR2GRAY)
    self.model_roi = model_roi
    self.crop_window = np.zeros_like(self.img_raw_c)
    self.scale_window = np.zeros_like(self.img_raw_c)
    self.scale_bar_window = np.zeros_like(self.img_raw_c)
    self.rect_window = np.zeros_like(self.img_raw_c)
    self.im = self.img_raw_c.copy()
    self.refPt_x_c = [0, self.img_raw_c.shape[1]]
    self.refPt_y_c = [0, self.img_raw_c.shape[0]]
    self.refPt_x = (0, 0)
    self.refPt_y = (0, 0)
    
  @timeit
  def detect_func(self, source, model=None):
    model.to(device="cpu")
    # source = f'{source}' # file/dir/URL/glob, 0 for webcam
    imgsz = (640, 640) # inference size (height, width)
    conf_thres = 0.25 # confidence threshold
    iou_thres = 0.45 # NMS IOU threshold
    max_det = 1000 # maximum detections per image
    classes = None # filter by class: --class 0, or --class 0 2 3 
    agnostic_nms = False # class-agnostic NMS 
    augment = False # augmented inference 
    source = str(source)
    stride, names, pt = model.stride, model.names, model.pt
    imgsz = check_img_size(imgsz, s=stride) # check image size
    
    # Dataloader
    dataset = LoadImages(source, img_size=imgsz, stride=stride, auto=pt)
    bs = 1 # batch_size
    
    # Run inference
    model.warmup(imgsz=(1 if pt else bs, 3, *imgsz)) # warmup
    seen, windows, dt = 0, [], [0.0, 0.0, 0.0]
    for path, im, im0s, vid_cap, s in dataset:
      t1 = time_sync()
      im = torch.from_numpy(im).to(select_device("cpu"))
      im = im.half() if model.fp16 else im.float() # uint8 to fp16/32 
      im /= 255 # 0 - 255 to 0.0 - 1.0
      if len(im.shape) == 3:
        im = im[None] # expand for batch dim
      t2 = time_sync()
      dt[0] += t2 - t1
      
      # Inference
      pred = model(im, augment=augment)
      t3 = time_sync()
      dt[1] += t3 - t2
      
      # NMS
      pred = non_max_suppression(pred, conf_thres, iou_thres, classes, agnostic_nms, max_det=max_det)
      dt[2] += time_sync() - t3
      
      # Second-stage classifier (optional)
      # pred = utils.general.apply_classifier(pred, classifier_model, im, im0s)
      
      # Process predictions
      for i, det in enumerate(pred): # per image
        seen += 1
        p, im0, frame = path, im0s.copy(), getattr(dataset, "frame", 0)
        
        p = Path(p) # to Path
        s += "%gx%g " % im.shape[2:] # print string
        gn = torch.tensor(im0.shape)[[1, 0, 1, 0]] # normalization gain whwh 
        if len(det):
          # Rescale boxes from img_size to im0 size
          det[:, :4] = scale_coords(im.shape[2:], det[:, :4], im0.shape).round()
          
          # Print results
          for c in det[:, -1].unique():
            n = (det[:, -1] == c).sum() # detections per class
            s += f"{n} {names[int(c)]}{'s' * (n > 1)}, " # add to string
            
          # Write results
          # cls_dic = {0:'Scalebar', 1:'Scale', 2:'Image'}
          
          img = cv2.imread(source)
          result_df = pd.DataFrame(columns=["x1", "y1", "x2", "y2", "class_name", "score", "w", "h"])
          i = 0 
          for *xyxy, conf, cls in reversed(det):
            xywh = (xyxy2xywh(torch.tensor(xyxy).view(1, 4)) / gn).view(-1).tolist() # normalized xywh
            
            x, y, w, h = xywh
            imh = img.shape[0]
            imw = img.shape[1]
            
            x = int(x * imw)
            y = int(y * imh)
            w = int(w * imw)
            h = int(h * imh) 
            
            x1 = int(x - 0.5 * w) 
            x2 = int(x + 0.5 * w) 
            y1 = int(y - 0.5 * h)
            y2 = int(y + 0.5 * h) 
            
            result_df.loc[i] = [x1, y1, x2, y2, int(cls), float(conf), w, h]
            i += 1
            
          # scale array 좌표 영역 늘리기 y 기준 0.005 -> 0.015
          result_df.loc[result_df["class_name"] == 0, "x1"] = result_df.loc[result_df["class_name"] == 0, "x1"] - int(0.0005 * imw)
          result_df.loc[result_df["class_name"] == 0, "x2"] = result_df.loc[result_df["class_name"] == 0, "x2"] + int(0.0005 * imw)
          result_df.loc[result_df["class_name"] == 1, "y1"] = result_df.loc[result_df["class_name"] == 1, "y1"] - int(0.015 * imh)
          result_df.loc[result_df["class_name"] == 1, "y2"] = result_df.loc[result_df["class_name"] == 1, "y2"] + int(0.015 * imh)
          result_df.loc[result_df["class_name"] == 0, "w"] = result_df.loc[result_df["class_name"] == 0, "w"] + int(0.001 * imw)
          result_df.loc[result_df["class_name"] == 1, "h"] = result_df.loc[result_df["class_name"] == 1, "h"] + int(0.03 * imh)
          
          result_df.loc[result_df["class_name"] == 0, "class_name"] = "Scalebar"
          result_df.loc[result_df["class_name"] == 1, "class_name"] = "Scale"
          result_df.loc[result_df["class_name"] == 2, "class_name"] = "Images"
          
          columns = list(result_df.columns)
          columns.remove("class_name")
          columns.remove("score")
          for col in columns:
            result_df[col] = result_df[col].astype("int")
            
          return result_df
          
  @timeit
  def roi(self, model, input_scale=None, input_scalebar=None):
    self.roi_mode = "auto"
    # YOLO 이미지 ROI 설정
    
    self.DF = self.detect_func(self.fname, model)
    # self.DF.to_excel('df.xlsx')
    
    try:
      scale_id = self.DF[self.DF["class_name"] == "Scale"]["score"].idxmax()
      cv2.rectangle(self.scale_window, (self.DF.loc[scale_id, "x1"], self.DF.loc[scale_id, "y1"]), (self.DF.loc[scale_id, "x2"], self.DF.loc[scale_id, "y2"]), (255, 122, 255), 5) 
      self.rect_window = cv2.addWeighted(self.rect_window, 1, self.scale_window, 1, 1)
      self.scale_arr = cv2.bitwise_not(self.img_raw_c[self.DF.loc[scale_id, "y1"] : self.DF.loc[scale_id, "y2"], self.DF.loc[scale_id, "x1"] : self.DF.loc[scale_id, "x2"]]) 
      
      # scale array cut
      self.scale_arr = cv2.cvtColor(self.scale_arr, cv2.COLOR_BGR2GRAY)
      _, self.bi_scale_arr = cv2.threshold(self.scale_arr, 50, 255, cv2.THRESH_BINARY)
      
      wh_y_list = np.where(self.bi_scale_arr.sum(axis = 1)>=self.bi_scale_arr.shape[1]*255)[0]
      
      if len(wh_y_list) > 0 :
        check_idx_list = np.r_[[0], np.where(np.diff(wh_y_list) != 1)[0] + 1, [len(wh_y_list)]]
        wh_y_arr_list = [wh_y_list[check_idx_list[i]:check_idx_list[i+1]] for i in range(len(check_idx_list)-1)] 
        wh_y_arr_list_t = [wh_y_arr for wh_y_arr in wh_y_arr_list if wh_y_arr[0] <= self.bi_scale_arr.shape[0]//2] 
        wh_y_arr_list_b = [wh_y_arr for wh_y_arr in wh_y_arr_list if wh_y_arr[0] > self.bi_scale_arr.shape[0]//2] 
        
        cut_y_i = wh_y_arr_list_t[-1][0] if len(wh_y_arr_list_t) > 0 else 0 
        cut_y_f = wh_y_arr_list_b[0][-1] if len(wh_y_arr_list_b) > 0 else -1 
        self.scale_arr = self.scale_arr[cut_y_i : cut_y_f, :] 
        self.bi_scale_arr = self.bi_scale_arr[cut_y_i : cut_y_f, :] 
        
      reader = Reader(lang_list=["en"], gpu=False, model_storage_directory = "./Utils/EasyOCR/." )
      scale_str = reader.readtext(self.scale_arr, detail = 0, allowlist="0123456789pnum.", width_ths = 1, height_ths=1)[0] 
      
      print(">>>>", scale_str)
      self.scale = float(".".join([re.findall("\d+", char)[0] for char in scale_str.split(".") if len(re.findall("\d+", char))>0]))
      
    
    except: 
      self.scale = 1
      self.scale_arr = np.array([[255, 255], [255, 255]]).astype("uint8")
      print("scale_error")
      cv2.rectangle(self.scale_window, (self.DF.loc[scale_id, "x1"], self.DF.loc[scale_id, "y1"]), (self.DF.loc[scale_id, "x2"], self.DF.loc[scale_id, "y2"]), (255, 122, 255), 5) 
      self.rect_window = cv2.addWeighted(self.rect_window, 1, self.scale_window, 1, 1)
      
    # 웹프로그램용 scale 입력값 대체
    if input_scale:
      self.scale = input_scale
    try:
      self.scalebar_id = self.DF[self.DF["class_name"] == "Scalebar"]["score"].idxmax()
      
      xx1 = self.DF.loc[self.scalebar_id, 'x1']
      xx2 = self.DF.loc[self.scalebar_id, 'x2']
      yy1 = self.DF.loc[self.scalebar_id, 'y1']
      yy2 = self.DF.loc[self.scalebar_id, 'y2']
      
      print("==>", input_scalebar)
      print("==>", yy1, yy2, xx1, xx2)
      
      if input_scalebar:
        yy1 = input_scalebar[0]
        yy2 = input_scalebar[1]
        xx1 = input_scalebar[2]
        xx2 = input_scalebar[3]
        
      self.scale_bar_arr = cv2.cvtColor(self.img_raw_c[yy1: yy2, xx1: xx2], cv2.COLOR_BGR2GRAY)
      ret1, self.bi_scale = cv2.threshold(self.scale_bar_arr, 0.7 * self.scale_bar_arr.max(), 255, cv2.THRESH_BINARY) # | cv2.THRESH_OTSU) 
      self.scale_length = max(np.array(np.where(self.bi_scale.T == 255))[0]) - min(np.array(np.where(self.bi_scale.T == 255))[0]) 
      cv2.rectangle(self.scale_bar_window, (xx1, yy1), (xx2, yy2), (255, 255, 122), 5)
      
      ###### 
      center_idx = int(len(self.bi_scale) / 2)
      scale_bar_min = min(np.array(np.where(self.bi_scale.T == 255))[0])
      self.bi_scale = cv2.cvtColor(self.bi_scale, cv2.COLOR_GRAY2RGB)
      
      _xx1 = scale_bar_min
      _yy1 = center_idx
      _xx2 = scale_bar_min + self.scale_length
      _yy2 = center_idx
      cv2.line(self.bi_scale, (_xx1, _yy1 - 1), (_xx2, _yy2 - 1), (26, 13, 247), 1)
      cv2.line(self.bi_scale, (_xx1, _yy1), (_xx2, _yy2), (26, 13, 247), 1)
      cv2.line(self.bi_scale, (_xx1, _yy1 + 1), (_xx2, _yy2 + 1), (26, 13, 247), 1)
      
      # _xx1 = xx1 + scale_bar_min
      # _yy1 = yy1 + center_idx
      # _xx2 = xx2 + scale_bar_min + self.scale_length
      # _yy2 = yy1 + center_idx
      # cv2.line(self.scale_bar_window, (_xx1, _yy1 - 1), (_xx2, _yy2 - 1), (26, 13, 247), 1)
      # cv2.line(self.scale_bar_window, (_xx1, _yy1), (_xx2, _yy2), (26, 13, 247), 1)
      # cv2.line(self.scale_bar_window, (_xx1, _yy1 + 1), (_xx2, _yy2 + 1), (26, 13, 247), 1)
      ######
      self.rect_window = cv2.addWeighted(self.rect_window, 1, self.scale_bar_window, 1, 1)
    except:
      self.scale_length = 1
      self.bi_scale = np.array([[255, 255], [255, 255]]).astype("uint8")
      print("scalebar_error")
      
    try:
      self.image_id = self.DF[self.DF["class_name"] == "Images"]["score"].idxmax()
      self.cutrow = int(0.995 * self.DF.loc[self.image_id, "y2"])
      cv2.rectangle(self.crop_window, (int(0.005 * self.im.shape[1]), int(0.005 * self.im.shape[1])), (int(0.995 * self.im.shape[1]), int(0.995 * self.cutrow)), (255, 122, 255), 5)
      self.rect_window = cv2.addWeighted(self.rect_window, 1, self.crop_window, 1, 1)
    except:
      self.cutrow = self.im.shape[0]
      
    self.im = cv2.addWeighted(self.im, 1, self.rect_window, 0.9, 1)
    
    self.scale_ratio = self.scale / self.scale_length # 스케일바 길이에 따라 달리 지정
    # 이미지 ROI
    self.dst_raw = self.img_raw_c.copy()
    self.refPt_x_c = [5, int(0.995 * self.dst_raw.shape[1])]
    self.refPt_y_c = [5, self.cutrow]
    
    return self.refPt_x_c, self.refPt_y_c, self.im
    
  @timeit
  def image_cut(self, image_for_cut, cut_x, cut_y):
    self.dst_raw = image_for_cut[min(cut_y) : max(cut_y), min(cut_x) : max(cut_x)]
    # self.dst_raw = cv2.normalize(self.dst_raw, None, 0, 255, cv2.NORM_MINMAX) # ContrastrefPt_x 조절
    self.dst_raw_gray = cv2.cvtColor(self.dst_raw, cv2.COLOR_BGR2GRAY)
    return self.dst_raw, self.dst_raw_gray
    
  @timeit
  def detect_processing(self, input_scale=None, input_scalebar = None):
    self.refPt_x_c, self.refPt_y_c, self.im = self.roi(self.model_roi, input_scale=input_scale, input_scalebar=input_scalebar)
    self.dst_raw, self.dst_raw_gray = self.image_cut(self.img_raw_c, self.refPt_x_c, self.refPt_y_c)
    self.dst_gap_x, self.dst_gap_y = min(self.refPt_x_c), min(self.refPt_y_c)
    
    if input_scale:
      self.scale = input_scale
      self.scale_ratio = self.scale / self.scale_length
    
    return self.img_raw_c, self.img_raw_gray, self.dst_raw, self.dst_raw_gray, self.im, self.bi_scale, self.scale_arr, self.scale_ratio, self.scale, self.dst_gap_x, self.dst_gap_y 
    

#########################################################################################


# Droplet Analysis Class
class SAM_for_Droplet():
  @timeit
  def init(self, fname, model_roi, model_seg):

    self.fname = fname
    self.file = fname.split("/")[-1]
    
    self.model_roi = 
    self.model_seg = model_seg
    
    # default variables for dev mode (diameter)
    self.min_diameter_thr, self.max_diameter_thr = 0.5, 4.5 # um 
    self.web_self_dict = None
    
  @timeit
  def detect_roi(self, input_scale=None, input_scalebar = None):
    
    self.roiseg = SEMROI(self.fname, self.model_roi)
    self.img_raw_c, self.img_raw_gray, self.dst_raw, self.dst_raw_gray, self.im, self.bi_scale, self.scale_arr, self.scale_ratio, self.scale, self.dst_gap_x, self.dst_gap_y = self.roiseg.detect_processing(
      input_scale=input_scale, input_scalebar=input_scalebar)
      
    self.dst_gray_shape_cv = (self.dst_raw_gray.shape[1], self.dst_raw_gray.shape[0])
    self.dst_color_shape_cv = (self.dst_raw_gray.shape[1], self.dst_raw_gray.shape[0], 3)
    
  @timeit
  def get_seg_labels (self, input_shape = (512,512)) :
    
    self.edge = None
    self.particle = None
    
    self.dst_raw_c_512 = None
    self.dst_raw_gray_512 = None
    
    
    dst_raw_512 = cv2.resize(self.dst_raw_gray, dsize=(input_shape), interpolation=cv2.INTER_AREA)
    seg_input = dst_raw_512.reshape(-1, input_shape[1], input_shape[0], 1) / 255. 
    
    with tf.device("/cpu:0"):
      Results = self.model_seg.predict(seg_input)
      
    self.Results = Results
    edge = Results[0][:, :, 0].copy()
    edge = (255*edge).astype('uint8')
    edge_raw = edge.copy()
    edge = cv2.resize(edge, dsize=self.dst_gray_shape_cv, interpolation=cv2.INTER_LANCZOS4)
    edge[edge >= 255 * 0.3] = 255
    edge[edge < 255 * 0.3] = 0 
    
    particle = Results[0][:, :, 1].copy()
    particle = (255*particle).astype('uint8')
    particle_raw = particle.copy()
    particle = cv2.resize(particle, dsize=self.dst_gray_shape_cv, interpolation=cv2.INTER_LANCZOS4)
    particle[particle >= 255 * 0.3] = 255
    particle[particle < 255 * 0.3] = 0
    
    ###################################
    # watershed 안하기 때문에, seed, mean_bw 필요 없음
    ###################################
    
    self.edge = edge 
    self.particle = particle
    
    self.edge_raw = edge_raw 
    self.particle_raw = particle_raw
    
  @timeit
  def get_seg_droplets (self, poly = False) :
    
    # matchShape distance 기준으로 droplet 선별
    shape_dist_thr = 0.2 
    
    # Watershed 없는 버전
    self.edge = Noise_rm(self.edge, 30)
    self.particle = Noise_rm(self.particle, 30)
    
    self.cnts = [] 
    self.color_list = []
    self.dst_canvas_droplet = np.zeros(self.dst_raw.shape, dtype='uint8')# color droplet
    self.dst_canvas_seg = np.zeros(self.dst_raw_gray.shape, dtype='uint8') # gray droplet 
    self.dst_canvas_edge = np.zeros(self.dst_raw_gray.shape, dtype='uint8') 
    
    self.dic_seg_list = [] 
    
    edge_sq = self.edge.copy()
    edge_sq[:, -5:] = 255 
    edge_sq[:,:5] = 255
    edge_sq[:5, :] = 255
    edge_sq[-5:, :] = 255 
    
    contours_i, _ = cv2.findContours(self.particle, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    kernel = np.ones((5,5), dtype = 'uint8')
    idx = 0 
    
    for i, cnt_i in enumerate(contours_i) : # 일단 전체사이즈로 만들고 나중에 crop으로 고치기
      particle_i = np.zeros(self.dst_raw_gray.shape, dtype = 'uint8')
      cv2.drawContours(particle_i, [cnt_i], 0, 255, -1)
      particle_i = cv2.dilate(particle_i, kernel, iterations = 2)
      contours, _ = cv2.findContours(particle_i, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
      part_cnt = max(contours, key=cv2.contourArea)
      
      edge_inter = edge_sq.copy()
      edge_inter[particle_i!=255] = 0
      
      if edge_inter.sum() > 0 :
        inter_contours, _ = cv2.findContours(edge_inter, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        inter_cnt = max(inter_contours, key=cv2.contourArea) 
        inter_area = cv2.contourArea(inter_cnt)
        
        # Edge가 Droplet 모양을 더 잘 살리기 때문에, inter_cnt를 기준으로 함
        if inter_area > 0 : 
          
          shape_dist = cv2.matchShapes(part_cnt, inter_cnt, cv2.CONTOURS_MATCH_I3, 0)
          
          cnt_area = cv2.contourArea(inter_cnt)
          diameter = np.sqrt(cnt_area / np.pi) * self.scale_ratio * 2
          
          if (shape_dist < shape_dist_thr) & (diameter >= self.min_diameter_thr) & (diameter < self.max_diameter_thr) : 
            
            idx +=1 
            
            hull = cv2.convexHull(inter_cnt)
            
            y_min = inter_cnt[:, :, 1:2].min()
            y_max = inter_cnt[:, :, 1:2].max() + 1 # slicing용 +1 
            x_min = inter_cnt[:, :, 0:1].min()
            x_max = inter_cnt[:, :, 0:1].max() + 1 # slicing용 +1 
            
            crop_canvas_i = np.zeros([y_max-y_min, x_max-x_min], dtype = 'uint8')
            crop_edge_i = np.zeros([y_max-y_min, x_max-x_min], dtype = 'uint8')
            crop_cnt = inter_cnt.copy()
            crop_cnt[:,:,0] = inter_cnt[:,:,0] - x_min
            crop_cnt[:,:,1] = inter_cnt[:,:,1] - y_min
            cv2.drawContours(crop_canvas_i, [crop_cnt], 0, 255, -1)
            cv2.drawContours(crop_edge_i, [crop_cnt], 0, 255, 5)
            
            border_size = round(max(x_max-x_min, y_max-y_min)/10)
            
            crop_seg_mask_i = crop_canvas_i.copy()
            crop_seg_mask_i = cv2.copyMakeBorder(crop_seg_mask_i, border_size, border_size, border_size, border_size, borderType=cv2.BORDER_CONSTANT)
            crop_edge_mask_i = crop_edge_i.copy()
            crop_edge_mask_i = cv2.copyMakeBorder(crop_edge_mask_i, border_size, border_size, border_size, border_size, borderType=cv2.BORDER_CONSTANT)
            
            # fit, crop match
            fit_x_min, crop_x_min = (0, border_size - x_min) if x_min - border_size < 0 else (x_min - border_size, 0) 
            fit_x_max, crop_x_max = (self.dst_raw.shape[1], crop_seg_mask_i.shape[1] - (x_max + border_size - self.dst_raw.shape[1])) if x_max + border_size > self.dst_raw.shape[1] else (x_max + border_size, crop_seg_mask_i.shape[1])
            fit_y_min, crop_y_min = (0, border_size - y_min) if y_min - border_size < 0 else (y_min - border_size, 0) 
            fit_y_max, crop_y_max = (self.dst_raw.shape[0], crop_seg_mask_i.shape[0] - (y_max + border_size - self.dst_raw.shape[0])) if y_max + border_size > self.dst_raw.shape[0] else (y_max + border_size, crop_seg_mask_i.shape[0])
            
            
            # edge를 걸러야하니까, 정보화를 먼저해야됨
            # 정보화 (cnt, crop_cnt 동일, com 때문에 crop_cnt로)
            dic = {}
            perimeter = cv2.arcLength(inter_cnt, True) # 둘레
            perimeter_hull = cv2.arcLength(hull, True) # convex 둘레
            
            dic["Segment"] = idx # 1부터 시작
            dic["cnt_area"] = cnt_area 
            dic["Diameter (um)"] = diameter # 평균 직경 
            dic["Area (um2)"] = cnt_area * (self.scale_ratio**2) # 면적 저장
            dic["Perimeter (um)"] = perimeter * self.scale_ratio # 둘레 저장
            dic["Circularity"] = 4 * np.pi * cnt_area / ((perimeter) ** 2) # 원형도
            dic["Convexity"] = perimeter_hull / perimeter # 원형도
            dic["Solidity"] = cnt_area / cv2.contourArea(hull) # 원형도
            
            # 무게중심 
            M = cv2.moments(crop_cnt)
            crop_cx = int(M["m10"] / M["m00"])
            crop_cy = int(M["m01"] / M["m00"])
            dic["crop_com"] = (crop_cx, crop_cy) 
            dic['Center of moment'] = (crop_cx+fit_x_min-crop_x_min, crop_cy+fit_y_min-crop_y_min) # api와 맞추기 위해서 org
            
            eigen_values, eigen_vectors = np.linalg.eig(np.cov(crop_cnt[:, 0, :].T)) # 그림 x,y가 반대이므로 transpose 
            e_value_1 = max(eigen_values) 
            e_value_2 = min(eigen_values)
            
            # x축과 각 contour center와의 각도 cos로
            cnt_center = crop_cnt - [crop_cx, crop_cy]
            unit_x = [0,1]
            cnt_ang_list = []
            
            for cntxy in cnt_center :
              ang_x_cnt = get_vector_angle(unit_x, cntxy[0])
              cnt_ang_list.append(ang_x_cnt)
            
            # 장축, 단축 방향 계산
            major_direct = eigen_vectors[:, np.argmax(eigen_values)] 
            minor_direct = eigen_vectors[:, np.argmin(eigen_values)] 
            
            # 약 1도 각도 차이 있으나, 1pix 차이로 컨트롤 할 수 없음 
            major_idx_1 = np.argmin(np.abs(np.array(cnt_ang_list) - get_vector_angle(unit_x, major_direct))) 
            major_idx_2 = np.argmin(np.abs(np.array(cnt_ang_list) - get_vector_angle(unit_x, -major_direct)))
            minor_idx_1 = np.argmin(np.abs(np.array(cnt_ang_list) - get_vector_angle(unit_x, minor_direct))) 
            minor_idx_2 = np.argmin(np.abs(np.array(cnt_ang_list) - get_vector_angle(unit_x, -minor_direct))) 
            
            major_contact_length =(cnt_center.dot(major_direct)[major_idx_1] + cnt_center.dot(-major_direct)[major_idx_2])[0] * self.scale_ratio 
            minor_contact_length =(cnt_center.dot(minor_direct)[minor_idx_1] + cnt_center.dot(-minor_direct)[minor_idx_2])[0] * self.scale_ratio 
            
            dic["Aspect ratio"] = np.sqrt(e_value_1 / e_value_2) # 종횡비 
            dic["Major diameter (um)"] = major_contact_length # not major axis length, 실제 Droplet 사이즈 반영하기 위해 contour와 접점 
            dic["Minor diameter (um)"] = minor_contact_length 
            
            # edge 인접 seg 검출 기준 = 5 
            e_margin = 5 
            edge = True if (e_margin in inter_cnt) or (self.dst_raw.shape[1] -e_margin in inter_cnt[:, 0, 0]) or (self.dst_raw.shape[0] -e_margin in inter_cnt[:, 0, 1]) else False 
            dic["Edge"] = edge 
            
            
            
            # Valid condition (Edge, 원형도)
            
            if (dic["Edge"] == False) & (dic["Convexity"] > 0.9) & (dic["Solidity"] > 0.9) & (dic["Circularity"] > 0.75) :
              
              # df_seg 
              self.dic_seg_list.append(dic) 
              self.cnts.append(inter_cnt) 
              
              # draw Images 
              color_i = [int(j) for j in np.random.randint(0, 255, 3)] # 랜덤 color 
              self.color_list.append(color_i) 
              crop_seg_mask_i_c = cv2.cvtColor(crop_seg_mask_i, cv2.COLOR_GRAY2BGR) 
              crop_seg_mask_i_c[crop_seg_mask_i == 255] = color_i 
              
              self.dst_canvas_droplet[fit_y_min:fit_y_max, fit_x_min:fit_x_max] = self.dst_canvas_droplet[fit_y_min:fit_y_max, fit_x_min:fit_x_max] | crop_seg_mask_i_c[crop_y_min:crop_y_max, crop_x_min:crop_x_max] 
              self.dst_canvas_seg[fit_y_min:fit_y_max, fit_x_min:fit_x_max] = self.dst_canvas_seg[fit_y_min:fit_y_max, fit_x_min:fit_x_max] | crop_seg_mask_i[crop_y_min:crop_y_max, crop_x_min:crop_x_max] 
              self.dst_canvas_edge[fit_y_min:fit_y_max, fit_x_min:fit_x_max] = self.dst_canvas_edge[fit_y_min:fit_y_max, fit_x_min:fit_x_max] | crop_edge_mask_i[crop_y_min:crop_y_max, crop_x_min:crop_x_max] 
              
              
              
    # 입자 하나도 없을 때, 
    try : 
      self.df_seg = pd.DataFrame(self.dic_seg_list)
      self.df_seg['File'] = self.file
      self.df_seg = self.df_seg[["File", "Segment", "cnt_area", "Diameter (um)", "Major diameter (um)", "Minor diameter (um)", "Area (um2)", "Perimeter (um)", "Circularity", "Convexity", "Solidity", "Aspect ratio", "Center of moment"]] 
    except : 
      self.df_seg = pd.DataFrame(columns = [["File", "Segment", "cnt_area", "Diameter (um)", "Major diameter (um)", "Minor diameter (um)", "Area (um2)", "Perimeter (um)", "Circularity", "Convexity", "Solidity", "Aspect ratio", "Center of moment"]]) 
    
    self.im_out = cv2.addWeighted(self.dst_raw, 1, self.dst_canvas_droplet, 0.4, 1)
  
  
  
  
  def get_outputs(self): 
    
    output_img_dict = {} 
    output_value_dict = {} 
    
    ## output_img_dict 
    img_name_list = ["Raw Image", "Image with scale", "Image Seg"]
    img_list = [self.img_raw_c, self.im, self.im_out]
    for img_name, img in zip(img_name_list, img_list):
      output_img_dict[img_name] = img 
      
    ## output_value_dict 
    stat_col_list = ["Diameter (um)", "Major diameter (um)", "Minor diameter (um)", "Area (um2)", "Perimeter (um)", "Circularity", "Convexity", "Solidity", "Aspect ratio"]
    
    self.Diameter_avg, self.Majordiameter_avg, self.Minordiameter_avg, self.Area_avg, self.Perimeter_avg, self.Circularity_avg, self.Convexity_avg, self.Solidity_avg, self.AR_avg = self.df_seg[stat_col_list].mean()
    
    self.Diameter_std, self.Majordiameter_std, self.Minordiameter_std, self.Area_std, self.Perimeter_std, self.Circularity_std, self.Convexity_std, self.Solidity_std, self.AR_std = self.df_seg[stat_col_list].std()
    
    self.Stat_avg_n = [self.Diameter_avg, self.Majordiameter_avg, self.Minordiameter_avg, self.Area_avg, self.Perimeter_avg, self.Circularity_avg, self.Convexity_avg, self.Solidity_avg, self.AR_avg] 
    self.Stat_std_n = [self.Diameter_std, self.Majordiameter_std, self.Minordiameter_std, self.Area_std, self.Perimeter_std, self.Circularity_std, self.Convexity_std, self.Solidity_std, self.AR_std] 
    
    self.Coverage = self.df_seg["cnt_area"].sum() / (self.dst_raw.shape[0] * self.dst_raw.shape[1]) * 100 
    
    try: 
      self.Stat_avg_a = [] 
      self.Stat_std_a = [] 
      
      for stat_col in stat_col_list: 
        a_avg = sum(self.df_seg[stat_col] * self.df_seg["Area (um2)"]) / sum(self.df_seg["Area (um2)"]) 
        a_std = np.sqrt(sum(((self.df_seg[stat_col] - a_avg) ** 2 * self.df_seg["Area (um2)"])) / sum(self.df_seg["Area (um2)"])) 
        self.Stat_avg_a.append(a_avg) 
        self.Stat_std_a.append(a_std) 
        
    except: 
      self.Stat_avg_a = self.Stat_avg_n.copy() 
      self.Stat_std_a = self.Stat_std_n.copy() 
      
    self.Stat_avg_n = [round(v, 3) for v in self.Stat_avg_n] 
    self.Stat_std_n = [round(v, 4) for v in self.Stat_std_n] 
    
    self.Stat_avg_a = [round(v, 3) for v in self.Stat_avg_a] 
    self.Stat_std_a = [round(v, 4) for v in self.Stat_std_a] 
    self.Coverage = round(self.Coverage, 2) 
    
    value_name_list = [] 
    value_list = [] 
    
    for i, stat_col in enumerate(stat_col_list): 
      value_name_list.append(f"{stat_col} N_Avg.") 
      value_name_list.append(f"{stat_col} N_Std.") 
      value_list.append(self.Stat_avg_n[i]) 
      value_list.append(self.Stat_std_n[i]) 
    
    for i, stat_col in enumerate(stat_col_list): 
      value_name_list.append(f"{stat_col} A_Avg.") 
      value_name_list.append(f"{stat_col} A_Std.") 
      value_list.append(self.Stat_avg_a[i]) 
      value_list.append(self.Stat_std_a[i]) 
    
    for value_name, value in zip(value_name_list, value_list):
      output_value_dict[value_name] = value 
      
    output_value_dict["num of Droplets"] = int(len(self.df_seg)) 
    output_value_dict["Coverage (%)"] = self.Coverage 
    
    # Scale 관련 img, value 추가 
    
    output_img_dict["scalebar"] = self.roiseg.bi_scale 
    
    output_value_dict["scale"] = float(self.roiseg.scale) 
    output_value_dict["scale_ratio"] = float(self.roiseg.scale_ratio) 
    output_value_dict["scale_length"] = float(self.roiseg.scale_length) 
    
    output_value_dict["img_com"] = [(com_x + self.dst_gap_x, com_y + self.dst_gap_y) for (com_x, com_y) in self.df_seg["Center of moment"].values] 
    output_value_dict["dst_com"] = list(self.df_seg["Center of moment"].values) 
    
    return output_img_dict, output_value_dict 
    
  @timeit 
  def processing(self, input_scale = None, input_scalebar = None): # 수동지정 stateless 구현 필요 
    
    self.detect_roi(input_scale = input_scale, input_scalebar = input_scalebar) 
    self.get_seg_labels() 
    self.get_seg_droplets() 
    
    output_img_dict, output_value_dict = self.get_outputs()
    
    return output_img_dict, output_value_dict 


#########################################################################################

# main

model_roi = None
model_seg = None

@timeit
def unet_init():
  # with tf.device("/cpu:0"):
  global model_roi
  global model_seg
  
  model_roi = DetectMultiBackend("./Utils/Detection_v5/scalebar_best_0705.pt", device=select_device("cpu"), dnn=False, fp16=False) 
  model_seg = unet() 
  model_seg.load_weights('./Utils/Models/250307_segmodel_v2.h5') 
  
  
@timeit
def unet_main(image_file_name, option_min_diameter_thr, manual_scale = None, manual_scalebar = None):

  analyzer = SAM_for_Droplet(image_file_name, model_roi, model_seg) 
  
  # dev option 
  analyzer.min_diameter_thr = option_min_diameter_thr 
  
  output_img_dict, output_value_dict = analyzer.processing(input_scale = manual_scale, input_scalebar = manual_scalebar) 
  
  res = { 
    "output_img_dict": output_img_dict,
    "output_value_dict": output_value_dict, 
    "output_csv_detail": analyzer.df_seg, 
    
    "option_min_diameter_thr" : analyzer.min_diameter_thr 
  } 
  
  
  return res 


if __name__ == "__main__":
  print("=== analyzer_init ===")
  unet_init()
  
  # default dev option 
  option_min_diameter_thr = 0.5 
  
  print("=== analyzer_main (normal)===") 
  res = unet_main("./test.jpg", option_min_diameter_thr) 
  
  print("=== analyzer_main (abnormal_nan)===") 
  res = unet_main("./test_nan.png", option_min_diameter_thr) 

