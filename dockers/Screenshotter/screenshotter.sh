#!/bin/bash

# This script does a one-shot creation of screenshots, creating needed
# docker containers and removing them afterwards.  During development,
# it might be desirable to avoid the overhead for starting and
# stopping the containers.  Developers are encouraged to manage
# suitable containers themselves, calling the screenshotter.js script
# directly.

for browserTag in firefox:2.46.0; do
    browser=${browserTag%:*}
    image=selenium/standalone-${browserTag}
    echo "Starting container for ${image}"
    container=$(docker run -d -P ${image})
    [[ ${container} ]] || continue
    echo "Container ${container:0:12} started, creating screenshots..."
    res=Failed
    node "$(dirname "$0")"/screenshotter.js ${browser} ${container} && res=Done
    echo "${res} taking screenshots, stopping and removing ${container:0:12}"
    docker stop ${container} >/dev/null && docker rm ${container} >/dev/null
done
