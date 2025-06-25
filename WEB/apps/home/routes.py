# E1_p8000_WEB_sam_for_droplet_2024/apps/home/routes.py 

from apps import socketio
from apps.home import blueprint
from flask import render_template, request, session 
from flask_login import login_required
from jinja2 import TemplateNotFound
import json
import time 
import base64
import random
import logging
import requests 
import sqlite3
from datetime import datetime 


wLog = logging.getLogger()
wLog.setLevel(logging.INFO)

flagInitPingLoop = False 
con = sqlite3.connect('request_history.sqlite')
cur = con.cursor()
cur.execute("CREATE TABLE IF NOT EXISTS RequestHistory (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, user TEXT, file TEXT, desc TEXT);")
con.commit()

def ping_in_intervals():
  while True:
    socketio.sleep(60)
    socketio.emit('ping')
    
@socketio.on('connect')
def socket_conn(auth):
  wLog.info("connect")
  global flagInitPingLoop
  if flagInitPingLoop == False:
    _delay = random.uniform(0, 0.8)
    wLog.info(f"delay -> {str(_delay)}")
    time.sleep(_delay)
  if flagInitPingLoop == False:
    socketio.start_background_task(ping_in_intervals)
    wLog.info(f"flagInitPingLoop -> True")
    flagInitPingLoop = True
    
  @socketio.on('disconnect')
  def socket_dcon():
    wLog.info("disconnected")
    
  @socketio.on('pong')
  def socket_pong(data):
    wLog.info(", ".join([str(x) for x in list(data.values())]))
    
  @socketio.on('client info')
  def socket_info(data, methods=['GET', 'POST']):
    wLog.info(", ".join(list(data.values())))
    session["sid"] = data["sid"]
    session["username"] = data["user"]
    socketio.emit('connect response', data)
    
  @socketio.on('recv image file')
  def socket_exec(data, methods=['GET', 'POST']):
    wLog.info(f"{session['sid']} start -------------------------------")
    for file in data["files"]:
      wLog.info(f"{session['sid']} req > {file['filename']}")
      
      timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
      current_user = data["username"]
      req_filename = file["filename"]
      req_desc = "-"
      
      sql_string= f"INSERT INTO RequestHistory (date, user, file, desc) Values('{timestamp}', '{current_user}', '{req_filename}', '{req_desc}');"
      cur.execute(sql_string)
      con.commit()
      
      req_number = f"SAM{cur.lastrowid:07d}"
      
      file_content = base64.b64encode(file["file"])
      base64_file = file_content.decode('utf-8')
      
      socketio.emit('send start event', {
        "index": file["index"],
        "sid": session["sid"],
        "filename": file["filename"],
        "reqid": req_number,
      })
      
      start_time = time.perf_counter()
      
      try:
        res = requests.post(
          "http://localhost:8005/sam_for_droplet", 
          headers={"content-Type": "application/json"},
          data=json.dumps({
            "uid": data["uid"],
            "reqid": req_number,
            "timestamp": data["timestamp"],
            "username": data["username"],
            "filename": file["filename"],
            "image_base64": base64_file,
            "option_x0": data["opition_x0"],
            "option_x1": data["opition_x1"],
            "option_y0": data["opition_y0"],
            "option_y1": data["opition_y1"],
            "option_scale": data["option_scale"],
            "option_min_diameter_threshold": data["option_min_diameter_threshold"],
          }))
          
        res = json.loads(res.text)
        # res["status"] = 400  # API ERROR
        # res["error_msg"] = "API ERROR"
        res["index"] = file["index"]
        res["sid"] = session["sid"]
        wLog.info(f"{session['sid']} res < {res['status']} {res['filename']}")
      except Exception as e:
        res = {}
        res["status"] = 800  # WEB ERROR
        res["error_msg"] = f"WEB ERROR {e}"
        res["index"] = file["index"]
        res["sid"] = session["sid"]
        res["filename"] = file["filename"]
      end_time = time.perf_counter()
      res["exec_time"] = round(end_time - start_time, 2)
      socketio.emit('send image file', res)
    socketio.emit('state', {"state": "done", "sid": session["sid"]})
    wLog.info(f"{session['sid']} end ========================================")
      
  
  @blueprint.route('/index', methods=['GET'])
  @login_required
  def index():
    ui_mode = request.args.get('mode', default='user', type=str)
    
    # if ui_mode != "dev":
    #   ui_mode = "user"
    ui_mode = "user"
    
    
    # wLog.info(f"mode: {ui_mode}")
    
    return render_template('home/index.html', mode=ui_mode, time=time.time())
    
  
  @blueprint.route('/<template>')
  @login_required
  def route_template(template):
    wLog.info("")
    try:
      if not template.endswith('.html'):
        template += '.html'
      return render_template("home/" + template)
    
    except TemplateNotFound:
      return render_template('home/page-404.html'), 404 
    
    except:
      return render_template('home/page-500.html'), 500
