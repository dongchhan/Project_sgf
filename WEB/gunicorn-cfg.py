# -*- encoding: utf-8 -*- 
bind = '0.0.0.0:8000'
wsgi_app = "run:app"
workers = 1 #16 # socketio 쓸땐 1로..
# accesslog = '-'
loglevel = 'info'  # 'debug' -> 'info' -> 'warning' -> 'error' -> 'critical'
# capture_output = True
# enable_stdio_inheritance = True
timeout = 1000
threads = 4
reload = False
syslog_addr = "-"
worker_class = "eventlet"  # "sync"
# daemon = True