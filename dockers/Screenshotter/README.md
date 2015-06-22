### How to generate screenshotter images
----------------------------------------

Now you too can generate screenshots from your own computer, and (hopefully)
have them look mostly the same as the current ones! Make sure you have docker
installed and running. Also make sure that the development server is running,
or start it by running

    node server.js

in the top level directory of the source tree. If all you want is (re)create
all the snapshots for all the browsers, then you can do so by running the
`screenshotter.sh` script:

    dockers/Screenshotter/screenshotter.sh

It will fetch all required selenium docker images, and use them to
take screenshots. If you are creating screenshots on a regular basis,
you can keep the docker containers with the selenium setups running.
To do so, have a look at `screenshotter.sh` and reproduce its commands
manually.

Known bugs: The “Lap” example is known to produce slightly
nondeterministic results on firefox, for unknown reasons.
