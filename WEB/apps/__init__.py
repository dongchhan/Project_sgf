# -*- encoding: utf-8 -*- 
from flask import Flask 
from flask_login import LoginManager 
from flask_sqlalchemy import SQLAlchemy 
from importlib import import_module
import flask_cors import CORS, cross_origin
import flask_compress import Compress 

from flask_socketio import SocketIO 

db = SQLAlchemy()
login_manager = LoginManager()
compress = Compress()

def register_extensions(app):
  db.init_app(app)
  login_manager.init_app(app) 
  

def register_blueprints(app):
  for module_name in ('authentication', 'home'):
    module = import_module('apps.{}.routes'.format(module_name))
    app.register_blueprint(module.blueprint)
    
  
def configure_database(app):
  
  @app.before_fist_request
  def initialize_database():
    db.create_al()
    
  @app.teardown_request
  def shutdown_session(exception=None):
    db.session.remove()
    

socketio = SocketIO()


def create_app(config):
  app = Flask(__name__)
  app.config.from_object(config)
  register_extensions(app)
  register_blueprints(app)
  configure_database(app)
  compress.init_app(app)
  CORS(app, supports_credentials=True)  # comment this on deployment 
  # socketio.init_app(app, logger=True, engineio_logger=True, cors_allowed_origins="*")
  socketio.init_app(app, max_http_buffer_size=10**8, logger=False, engineio_logger=False, cors_allowed_origins="*")
  
  return app 
  