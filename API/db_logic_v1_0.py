'''
v2_0 [Unet ] - easyOCR
SGF용 PDLC Droplet 형상 분석 프로그램_경량화
PDLC Droplet Image Analysis for SGF
'''
import os
import sys
import time
import warnings
from pathlib import Path
from functools import wraps

import numpy as np
import pandas as pd

warnings.filterwarnings(action="ignore")

# test 이미지 저장용

import matplotlib.pyplot as plt
import seaborn as sns


##################################################################################################################

def timeit(func):
    @wraps(func)
    def timeit_wrapper(*args, **kwargs):
        start_time = time.perf_counter()
        result = func(*args, **kwargs)
        end_time = time.perf_counter()
        total_time = end_time - start_time
        print(f">>{func.__name__:>25s}(){total_time:>8.4f} s")
        return result

    return timeit_wrapper

#########################################################################################

class Transformer_for_Droplet () :
    def __init__ (self, api_input_dict, web_input_dict) :

        self.api_input_dict = api_input_dict
        self.web_input_dict = web_input_dict

    def get_db_detail_i (self) :

        df_seg_raw = self.api_input_dict['df_seg_raw']

        for file, group in df_seg_raw.groupby('File') : # 이미지당 df_seg 발생하므로 사실상 1개의 dataframe이나 명시적으로 groupby
            img_code = '.'.join(file.split('.')[:-1])

            # 개발품 유무에 따른 parsing (개발품은 nimg에 모든 정보 저장)
            # 기본적으로 _ 1개 이상으로 parsing 됨을 기준으로 함

            p_col_list = ['P_code', 'P_line', 'P_date', 'P_roll', 'P_lcr', 'P_nspl', 'P_nimg']
            p_code = img_code.split('_')[0].lower()
            if p_code == 'dev' :
                p_ni = '_'.join(img_code.split('_')[1:])
                dic = {}
                dic['P_code'] = p_code
                dic['P_nimg'] = p_ni

            else :
                p_cdate, p_roll, p_lcr, p_ns, p_ni = img_code.split('_')[1:]
                p_line = p_cdate[:2]
                p_date = p_cdate[2:]

                dic = {}
                
                p_value_list = [p_code, p_line, p_date, p_roll, p_lcr, p_ns, p_ni]

                for key, value in zip(p_col_list, p_value_list) :
                    dic[key] = value

            # df_db_detail
            df_db_detail_i = group.copy()
            for p_col in p_col_list :
                df_db_detail_i[p_col] = dic.setdefault(p_col, np.nan)

            # web_input_dict 추가
            for web_key, web_value in self.web_input_dict.items() :
                df_db_detail_i[web_key] = web_value

        self.df_db_detail_i = df_db_detail_i

        return df_db_detail_i
    



class Collector_for_Droplet () :

    def __init__ (self, df_db_detail_input) :

        self.df_db_detail_input = df_db_detail_input

        self.ph_min_diameter_thr = 0.5

    def get_db_detail_latest (self) :
                
        self.df_latest = pd.DataFrame()

        # 분석 일자(r_date) 기준 최신 분석 이미지 (독립 File) 추출
        for _, group in self.df_db_detail_input.groupby('File') : # 
            
            group[['R_date', 'R_time']] = group[['R_date', 'R_time']].astype(str)
            g_datetime = group[['R_date', 'R_time']].astype(int)
            latest_date = g_datetime['R_date'].max()
            latest_time = g_datetime[g_datetime['R_date'] == latest_date]['R_time'].max()

            latest_group = group[(group['R_date'] == str(latest_date)) & (group['R_time'] == str(latest_time))]

            self.df_latest = pd.concat([self.df_latest, latest_group]).reset_index(drop = True)

    def get_db_log_ph_add(self) :

        # df_latest → df_latest_ph → df_db_log_ph (p_date 기준 독립성)
        # 이상치 제거 후, diameter avg
        # 최근 20개 기준 CL, UCL, LCL (UCL, LCL 3시그마)

        # D_date는 R_Date중 가장 최신인것!

        df_latest_ph = self.df_latest[self.df_latest['P_code'] == 'ph']

        d_date = str(df_latest_ph['R_date'].astype('int').max())

        dic_list = []
        for p_date, group in df_latest_ph.groupby('P_date') :
            
            di_array = group[(group['R_select'] == True) & (group['Diameter (um)'] >= self.ph_min_diameter_thr)]['Diameter (um)'].values

            if len(di_array) > 0 :
                # IQR 방식 outlier 제거
                q1 = np.percentile(di_array, 25)
                q3 = np.percentile(di_array, 75)
                iqr = q3 - q1

                lower_bound = q1 - 1.5 * iqr
                upper_bound = q3 + 1.5 * iqr

                valid_dia_array = di_array[(di_array >= lower_bound) & (di_array <= upper_bound)]
                di_avg = valid_dia_array.mean()

                # info 모두 단일 정보
                p_code = group['P_code'].unique()[0]
                r_date = group['R_date'].unique()[0]

                dic = {}
                dic['D_date'] = d_date
                dic['P_code'] = p_code
                dic['P_date'] = p_date
                dic['R_date'] = r_date
                dic['Diameter_N_Avg'] = di_avg

                dic_list.append(dic)

        df_db_log_ph_add = pd.DataFrame(dic_list)


        # 관리 기준선 추가, 최근 20개 데이터 기준 (변경 가능)
        control_n = 20
        cl = df_db_log_ph_add['Diameter_N_Avg'][-control_n:].mean()
        cstd = df_db_log_ph_add['Diameter_N_Avg'][-control_n:].std()
        ucl = cl + 3*cstd
        lcl = cl - 3*cstd

        df_db_log_ph_add['CL'] = cl
        df_db_log_ph_add['UCL'] = ucl
        df_db_log_ph_add['LCL'] = lcl

        self.df_db_log_ph_add = df_db_log_ph_add


    def processing(self) :

        self.get_db_detail_latest()
        self.get_db_log_ph_add()

        return self.df_db_log_ph_add
    


class Displayer_for_Droplet () :

    def __init__ (self, df_db_log_ph_input) :

        self.df_db_log_ph_input = df_db_log_ph_input

    def get_db_log_display (self) :
        d_date = str(self.df_db_log_ph_input['D_date'].astype('int').max())

        self.df_db_log_ph_input[['D_date', 'R_date', 'P_date']] = self.df_db_log_ph_input[['D_date', 'R_date', 'P_date']].astype(int).astype(str)

        df_db_log_ph_display = self.df_db_log_ph_input[self.df_db_log_ph_input['D_date'] == d_date]
        df_db_log_ph_display = df_db_log_ph_display.sort_values(by = 'P_date')

        self.df_db_log_ph_display = df_db_log_ph_display

    def mapping(self) :
        display_dict = {}
        display_dict['X_arr'] = self.df_db_log_ph_display['P_date'].values
        display_dict['Y_arr'] = self.df_db_log_ph_display['Diameter_N_Avg'].values
        display_dict['CL_y'] = self.df_db_log_ph_display['CL'].values[0]
        display_dict['UCL_y'] = self.df_db_log_ph_display['UCL'].values[0]
        display_dict['LCL_y'] = self.df_db_log_ph_display['LCL'].values[0]

        return display_dict



############################################################################################################################
    
# 분석 흐름을 위해 __main__에 모든 함수 구현하였지만, 실제 Web 연동 Action에 맞게 동찬씨가 함수 단위로 분리 mapping 해야 함
    
# 전체 Class 에서 date가 'str' 대신 'int', 'float' 인식되어 전처리가 많이 들어감 → DB mapping 때 명확히 지정되도록 하고 수정
    
############################################################################################################################

@timeit
def db_transfomer_img(api_input_dict, web_input_dict) :

    transformer = Transformer_for_Droplet(api_input_dict, web_input_dict)
    df_db_detail_i = transformer.get_db_detail_i()

    return df_db_detail_i

def db_stacking_run(df_db_detail_i_list) :
    df_db_detail_add = pd.DataFrame()

    for df_db_detail in df_db_detail_i_list :
        df_db_detail_add = pd.concat([df_db_detail_add, df_db_detail]).reset_index(drop = True)

    return df_db_detail_add

def db_collector_run(df_db_detail_input) :

    collector = Collector_for_Droplet(df_db_detail_input)
    df_db_log_ph_add = collector.processing()

    return df_db_log_ph_add

def db_displayer_run(df_db_log_ph_input) :
    displayer = Displayer_for_Droplet(df_db_log_ph_input)
    displayer.get_db_log_display()
    display_dict = displayer.mapping()
    return display_dict, displayer.df_db_log_ph_display


###############################################################################################################

# 분석 순서 확인을 위해 __main__ 에 나열하지만, 'Action'에 맞춰서 동찬씨가 함수 단위로 분리해서 mapping 해야 함

# img / run / display 단위로 class 구분

# global 변수 필요 없어서 init 없이 수행 (나중에 동찬씨 코드 연계에서 필요하면 run, display 클래스 객체 선언 가능)
    
# save_flag 누르면

###############################################################################################################

if __name__ == "__main__":

    print("=== transformer (per img) ===")
    ###################################################################
    ##### 단일 분석으로 연결되야 하며, 실제로는 run 한번당 img 여러개 #####
    ###################################################################
    
    # 실제로는 unet_logic api 에서 불러와야 함
    df_seg_raw = pd.read_csv('./250625_db_test/1_df_seg_raw/20250404/df_seg_raw_ph_1C20250312_3.csv', index_col = 0)
    api_input_dict = {'df_seg_raw' : df_seg_raw}
    web_input_dict = {'R_reqid' : 'SAM0003300',
                       'R_date' : '20250404',
                       'R_time' : '150859',
                       'R_user' : 'jihan',
                       'R_minthr' : 0.5,
                       'R_select' : True}
    df_db_detail_i = db_transfomer_img(api_input_dict, web_input_dict)


    # 실제로는 동찬씨가 여러 이미지 분석결과 호출 받아서 모아야함
    df_db_detail_i.to_csv('./250625_db_test_api_output/1_df_db_detail_ph_1C20250312_3_output.csv')

    
    print("=== collector : save db 눌렀을 때 작동 (per run) ===")
    # 여러 이미지 결과 list로 들어온다고 가정, 추후 변환 필요
    flag_save_db = True
    df_db_detail_i_list = None

    # Run date 기준으로 테스트
    r_date = '20250428' # 20250404
    df_db_detail_i_list = []
    load_path = f'./250625_db_test/1_df_seg_raw/{r_date}'
    for db_detail_fname in [os.path.join(load_path, file_name) for file_name in os.listdir(load_path)] :
        df_db_detail_i = pd.read_csv(db_detail_fname, index_col = 0)
        df_db_detail_i_list.append(df_db_detail_i)
    
    if flag_save_db :
        df_db_detail_add = db_stacking_run(df_db_detail_i_list)

        ###################################################################
        ##### df_db_detail_add DB로 전송해서 합치는 작업 추가 #####
        ###################################################################
        ##### DB에서 df_db_detail_input (org + add) 불러오는 작업 추가 #####
        ###################################################################

        # 실제로는 동찬씨가 DB로 전송
        df_db_detail_add.to_csv(f'./250625_db_test_api_output/2_df_db_detail_add_{r_date}_output.csv')

        # 실제로는 DB에서 불러와야 함
        df_db_detail_input = pd.read_csv(f'./250625_db_test/3_df_db_detail_total/df_db_detail_total_{r_date}.csv', index_col = 0)
        df_db_log_ph_add = db_collector_run(df_db_detail_input) 

        ###################################################################
        ##### df_db_log_ph_add DB로 전송해서 합치는 작업 추가 #####
        ###################################################################

        # 실제로는 동찬씨가 DB로 전송
        df_db_log_ph_add.to_csv(f'./250625_db_test_api_output/3_df_db_log_ph_add_{r_date}_output.csv')

    print("=== plotter: 동찬 (per run) ===")
    ###################################################################
    ##### df_db_log_ph_add == df_display, 하지만 항상 떠있어야 하므로 DB와 맵핑 #####
    ##### DB에서 df_db_log_ph_input (org + add) 불러오는 작업 추가 #####
    ###################################################################

    # 실제로는 DB에서 불러와야 함
    df_db_log_ph_input = pd.read_csv(f'./250625_db_test/6_df_db_log_ph_total/df_db_log_ph_total_{r_date}.csv', index_col = 0)
    display_dict, df_display = db_displayer_run(df_db_log_ph_input)

    #
    plt.figure()
    plt.plot(display_dict['X_arr'].astype(str), display_dict['Y_arr'])
    plt.axhline(y = display_dict['CL_y'], color = 'darkgray', linewidth = 0.5)
    plt.axhline(y = display_dict['UCL_y'], color = 'red', linewidth = 0.5, linestyle='--')
    plt.axhline(y = display_dict['LCL_y'], color = 'red', linewidth = 0.5, linestyle='--')
    plt.savefig(f'./250625_db_test_api_output/4_plot_display_{r_date}.png')

    print("=== end ===")