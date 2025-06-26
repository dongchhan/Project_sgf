# -- coding: utf-8 --
import gc
import cv2
import json
import base64
import uvicorn
import numpy as np
import pandas as pd
from PIL import Image
from io import BytesIO
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, Query
from pydantic import BaseModel, Field

import sam_logic_v1_3_2 as sam_logic
import unet_logic_v2_0_0 as unet_logic

description = """
PDLC Droplet Image Analysis for SGF - API Server 🚀

첨단 DX팀

2024.03.

Internal Use Only
"""

core_version = "2.0.0"

class NumpyEncoder(json.JSONEncoder):
  def default(self, obj):
    if isinstance(obj, np.integer):
      return int(obj)
    if isinstance(obj, np.floating):
      return float(obj)
    if isinstance(obj, np.ndarray):
      return obj.tolist()
    if isinstance(obj, pd.Series):
      return obj.tolist()
    return super(NumpyEncoder, self).default(obj)

# TEST
with open("test.jpg", "rb") as image_file:
  test_base64_file = base64.b64encode(image_file.read())

class Item(BaseModel):
  uid: str = Field("1234", title="UUID code")
  reqid: str = Field("CP0000000", title="request id")
  filename: str = Field("test.jpg", title="filename")
  image_base64: str = Field(test_base64_file, title="image base64 data")

  option_scale: Optional[float] = Field(None, title="scale")
  option_x0: Optional[int] = Field(0, title="option_x0")
  option_x1: Optional[int] = Field(0, title="option_x1")
  option_y0: Optional[int] = Field(0, title="option_y0")
  option_y1: Optional[int] = Field(0, title="option_y1")
  
  option_min_diameter_threshold: Optional[float] = Field(0.5, title="opt_min_diameter_threshold")
  
  username: Optional[str] = Field("username", title="username")
  timestamp: Optional[str] = Field("timestamp", title="timestamp") 
  
  
class Result(BaseModel):
  uid: Optional[str] = Field(title="UUID code")
  core: Optional[str] = Field(title="core version")
  reqid: Optional[str] = Field(title="request id")
  status: Optional[int] = Field(title="status", description="<b>실행 결과를 int 값으로 전달 합니다.</b> <br> 200: OK <br> 400 : NOK")
  filename: Optional[str] = Field(title="filename")
  filename_category: Optional[str] = Field(title="filename_category")

  option_scale: Optional[float] = Field(title="scale")
  calc_scaleratio: Optional[float] = Field(title="scaleratio")
  calc_scalerbarpixel: Optional[float] = Field(title="scalerbarpixel")
  description: Optional[str] = Field(title="particle crack")
  error_msg: Optional[str] = Field(title="error_msg")
  
  image_raw: Optional[str] = Field(title="image_raw")
  image_bi_scale: Optional[str] = Field(title="image_bi_scale")
  image_out: Optional[str] = Field(title="image_out")
  
  image_scalebar: Optional[str] = Field(title="image_scalebar")
  
  # data: Optional[str] = Field(title="data")
  data_statistics: Optional[str] = Field(title="data")
  data_detail: Optional[str] = Field(title="data")
  option_min_diameter_thr: Optional[float] = Field(title="data")
  
  image_filename: Optional[str] = Field(title="image_filename_original") 
  
  
def create_app():
  app = FastAPI(
    title="PDLC Droplet Image Analysis for SGF - API Server",
    description=description,
    version=core_version,
    contact={
      "name": "sanghoon.kim",
      "email": "sanghoon.kim@lgchem.com",
    },
  )
  return app
  
  
app = create_app()
unet_logic.unet_init()


@app.post("/sam_for_droplet", response_model=Result, response_model_exclude_unset=True)
async def run_sam_for_droplet(recvdata: Item):
  res_status_code = 200
  error_msg = ""
  filename = Path(recvdata.filename).stem
  filename_1 = recvdata.reqid + "" + recvdata.timestamp + "" + recvdata.username + "" + _filename + ".png"
  new_filename = "image_raw/" + filename_1
  print(">>>> filename :", new_filename)
  
  im = Image.open(BytesIO(base64.b64decode(recvdata.image_base64)))
  im.save(new_filename, 'PNG')
  
  try: 
    print("recvdata.option_scale", recvdata.option_scale)
    
    manual_scalebar = None 
    if recvdata.option_x0 != 0:
      print("----> manual scale bar")
      manual_scalebar = [recvdata.option_y0, recvdata.option_y1,
      recvdata.option_x0, recvdata.option_x1]
      
    # option_min_diameter_thr = 0.5
    sam_result = unet_logic.unet_main(new_filename, float(recvdata.option_min_diameter_threshold), manual_scale = recvdata.option_scale, manual_scalebar = manual_scalebar)
    
    _, _image_out = cv2.imencode('.PNG', sam_result["output_img_dict"]['Image Seg'])
    _, _image_bi_scale = cv2.imencode('.PNG', sam_result["output_img_dict"]['Image with scale'])
    _, _image_scalebar = cv2.imencode('.PNG', sam_result["output_img_dict"]['scalebar'])
    
    im10 = Image.open(BytesIO(base64.b64decode(base64.b64encode(_image_out))))
    new_filename = "image_out/" + filename_1
    im10.save(new_filename, 'PNG')
    
    im13 = Image.open(BytesIO(base64.b64decode(base64.b64encode(_image_bi_scale))))
    new_filename = "image_bi_scale/" + filename_1
    im13.save(new_filename, 'PNG')
      
    
  except Exception as e:
    res_status_code = 400
    error_msg = e
    print(">>>> error :", error_msg)
    
  # print(">", sam_result["output_value_dict"])
  
  # print(">>", sam_result["output_csv_detail"])
  
  res = Result()
  if res_status_code == 200:
    res.uid = recvdata.uid
    res.core = core_version
    res.reqid = recvdata.reqid
    res.status = res_status_code
    res.filename = recvdata.filename
    
    res.image_raw = recvdata.image_base64
    res.image_bi_scale = base64.b64encode(_image_bi_scale)
    res.image_out = base64.b64encode(_image_out)
    res.image_scalebar = base64.b64encode(_image_scalebar)
    
    res.data_statistics = json.dumps(sam_result["output_value_dict"], cls=NumpyEncoder).replace("NaN", "null")
    res.data_detail = sam_result["output_csv_detail"].to_json(orient='columns')
    res.option_min_diameter_thr = sam_result["option_min_diameter_thr"]
    
    res.option_scale = sam_result["output_value_dict"]["scale"]
    res.calc_scaleratio = sam_result["output_value_dict"]["scale_ratio"]
    res.calc_scalerbarpixel = sam_result["output_value_dict"]["scale_length"]
    res.image_filename = filename_1
    
    temp = recvdata.filename.split("]")
    print("len", len(temp))
    
    if len(temp) > 1:
      _temp = temp[0].split("[")
      if len(_temp) > 1:
        res.filename_category = _temp[-1]
      else:
        res.filename_category = "unknown
    else:
      res.filename_category = "unknown"
  else:
    res.uid = recvdata.uid
    res.core = core_version
    res.reqid = recvdata.reqid
    res.status = res_status_code
    res.filename = recvdata.filename
    res.error_msg = error_msg
    
  gc.collect()
  return res 
  
if __name__ == "__main__":
  uvicorn.run("main:app", host="0.0.0.0", port=8005, reload=True)









