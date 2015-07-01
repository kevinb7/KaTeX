# How to generate screenshotter images

## Automatic generation of screen shots

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
take screenshots.

## Manual generation

If you are creating screenshots on a regular basis, you can keep the
docker containers with the selenium setups running.  Essentially you
are encouraged to reproduce the steps from `screenshotter.sh`
manually.  Example run for Firefox:

    container=$(docker run -d -P selenium/standalone-firefox:2.46.0)
    node dockers/Screenshotter/screenshotter.js firefox ${container}
    # possibly repeat the above command as often as you need, then eventually
    docker stop ${container}
    docker rm ${container}

For Chrome, simply replace both occurrences of `firefox` with `chrome`.

You can pass an extra command line argument to `screenshotter.js`,
indicating the test cases to process, as a comma-separated list.
If that list starts with a `-`, it instead indicates test cases to exclude.

## Use without docker

It is possible to run `screenshotter.js` without the use of Docker:

    npm install selenium-webdriver
    node dockers/Screenshotter/screenshotter.js

This will generate screenshots using the Firefox installed on your system.
Browsers other than Firefox are not supported at this moment.
If a suitable web driver has been installed manually, one can use the
`SELENIUM_BROWSER` environment variable to override the browser which is used,
but the output file names will still refer to `firefox`.
As described above, and extra argument can be used to indicate test cases.

Note that screenshots taken without Docker are very likely to disagree
from the ones stored in the repository, due to different versions of
various software components being used.  The screenshots taken in this
fashion are well suited for visual inspection, but for exact binary
comparisons it would be neccessary to carefully set up the environment
to match the one used by the Docker approach.
