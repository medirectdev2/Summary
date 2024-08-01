#!/bin/bash
apt install -y libgl1-mesa-glx
gunicorn --bind=0.0.0.0 --timeout 1200 app:app