# E1_p8000_WEB_sam_for_droplet_2024/run.py

from flask_migrate import Migrate
from sys import exit
from decouple import config

from apps.config import config_dict
from apps import create_app, db, socketio

DEBUG = config('DEBUG', default=True, cast=bool)

get_config_mode = 'Debug' if DEBUG else 'Production'

try:
    app_config = config_dict[get_config_mode.capitalize()]
except KeyError:
    exit('Error: Invalid <config_mode>. Expected values [Debug, Production]')

app = create_app(app_config)
app.secret_key = config('SECRET_KEY')
Migrate(app, db)

if DEBUG:
    app.logger.info('DEBUG = ' + str(DEBUG))
    app.logger.info('Environment = ' + get_config_mode)
    app.logger.info('DBMS = ' + app_config.SQLALCHEMY_DATABASE_URI)

if __name__ == "__main__":
    socketio.run(app, debug=True)

