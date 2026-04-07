#!/bin/bash

# Define the App ID and Config File
APP_ID="com.mymma.app"
CONFIG_FILE="/etc/geoclue/geoclue.conf"

# check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  exit
fi

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Geoclue config file not found at $CONFIG_FILE"
    exit 1
fi

# Check if App ID already exists in config
if grep -q "\[$APP_ID\]" "$CONFIG_FILE"; then
    echo "Configuration for $APP_ID already exists in $CONFIG_FILE"
else
    echo "Adding configuration for $APP_ID to $CONFIG_FILE..."
    # Append configuration securely
    cat >> "$CONFIG_FILE" <<EOL

[$APP_ID]
allowed=true
system=false
users=
EOL
    echo "Configuration added successfully."
    
    # Restart geoclue service
    echo "Restarting geoclue service..."
    systemctl restart geoclue
    echo "Done."
fi
