# -*- encoding: utf-8 -*- 
import os 
from decouple import config 


class Config(object):
  
  basedir = os.path.abspath(os.path.dirname(__file__))
  
  # Set up the App SECRET_KEY
  SECRET_KEY = config('SECRET_KEY')  # 시크릿 키 디폴트 설정 있었음. 
  
  # This will create a file in <app> FOLDER
  SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(basedir, 'user.sqlite')
  SQLALCHEMY_TRACK_MODIFICATIONS = False 
  

class ProductionConfig(Config):
  DEBUG = False 
  
  # Security
  SESSION_COOKIE_HTTPONLY = True 
  REMEBER_COOKIE_HTTPONLY = True 
  REMEBER_COOKIE_DURATION = 3600 
  
  # PostgreSQL database 
  SQLALCHEMY_DATABASE_URI = '{}://{}:{}@{}:{}/{}'.format(
    config('DB_ENGINE', default='postgresql'),
    config('DB_USERNAME', default='appseed'),
    config('DB_PASS', default='pass'),
    config('DB_HOST', default='localhost'),
    config('DB_PORT', default=5432),
    config('DB_NAME', default='appseed-flask')
    )
  
  
class DebugConfig(Config):
  DEBUG = True 
  

# Load all possible configurations 
config_dict = {
  'Production': ProductionConfig,
  'Debug': DebugConfig
}
    