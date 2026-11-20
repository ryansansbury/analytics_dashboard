import os
from app import create_app

app = create_app(os.getenv('FLASK_ENV', 'development'))

if __name__ == '__main__':
    # Flask's development server, for one machine. It listens on this machine
    # alone unless HOST says otherwise (the compose file sets it inside its
    # container). The debugger runs code for anyone who can reach the port, so
    # it stays off unless FLASK_DEBUG=1 asks for it. Production runs gunicorn.
    app.run(
        host=os.getenv('HOST', '127.0.0.1'),
        port=int(os.getenv('PORT', '5001')),
        debug=os.getenv('FLASK_DEBUG') == '1',
    )
