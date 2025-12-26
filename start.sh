#!/bin/bash
cd backend && gunicorn run:app --bind 0.0.0.0:$PORT --workers 2
