"use strict";

var fs = require("fs");
var path = require("path");
var selenium = require("selenium-webdriver");
var ip = require('ip');
var Docker = require('dockerode');
var Q = require('q');
var denodeify = require('denodeify');

var data = require("../../test/screenshotter/ss_data.json");

var dstDir = path.normalize(
    path.join(__dirname, "..", "..", "test", "screenshotter", "images"));

//////////////////////////////////////////////////////////////////////
// Process command line arguments

var opts = require("nomnom")
    .option("browser", {
        abbr: "b",
        "default": "firefox",
        help: "Name of the browser to use"
    })
    .option("container", {
        abbr: "c",
        type: "string",
        help: "Name or ID of a running docker container to contact"
    })
    .option("seleniumURL", {
        full: "selenium-url",
        help: "Full URL of the Selenium web driver"
    })
    .option("seleniumIP", {
        full: "selenium-ip",
        "default": "localhost",
        help: "IP address of the Selenium web driver"
    })
    .option("seleniumPort", {
        full: "selenium-port",
        "default": 4444,
        help: "Port number of the Selenium web driver"
    })
    .option("katexURL", {
        full: "katex-url",
        help: "Full URL of the KaTeX development server"
    })
    .option("katexIP", {
        full: "katex-ip",
        "default": ip.address(),
        help: "Full URL of the KaTeX development server"
    })
    .option("katexPort", {
        full: "katex-port",
        "default": 7936,
        help: "Port number of the KaTeX development server"
    })
    .option("include", {
        abbr: "i",
        help: "Comma-separated list of test cases to process"
    })
    .option("exclude", {
        abbr: "x",
        help: "Comma-separated list of test cases to exclude"
    })
    .parse();

var listOfCases;
if (opts.include) {
    listOfCases = opts.include.split(",");
} else {
    listOfCases = Object.keys(data);
}
if (opts.exclude) {
    var exclude = opts.exclude.split(",");
    listOfCases = listOfCases.filter(function(key) {
        return exclude.indexOf(key) === -1;
    });
}

var seleniumURL = opts.seleniumURL;
var katexURL = opts.katexURL;
var seleniumIP = opts.seleniumIP;
var seleniumPort = opts.seleniumPort;
var katexIP = opts.katexIP;

//////////////////////////////////////////////////////////////////////
// Work out connection to selenium docker container

function check(err) {
    if (!err) {
        return;
    }
    console.error(err);
    console.error(err.stack);
    process.exit(1);
}

if (!seleniumURL) {
    seleniumURL = "http://localhost:" + seleniumPort + "/wd/hub";
}
if (seleniumURL) {
    console.log("Selenium driver at " + seleniumURL);
} else {
    console.log("Selenium driver in local session");
}

if (!katexURL) {
    katexURL = "http://" + katexIP + ":" + opts.katexPort + "/";
}
var toStrip = "http://localhost:7936/"; // remove this from testcase URLs

//////////////////////////////////////////////////////////////////////
// Wait for container to become ready

var docker = new Docker();

function run(browser) {
    console.log("Running screenshotter for " + browser);
    var deferred = Q.defer();
    var image = 'selenium/standalone-' + browser + ':2.46.0';
    docker.createContainer({ Image: image }, function (err, container) {
        container.start({
            "PortBindings": {
                "4444/tcp": [
                    { "HostPort": "4444" }
                ]
            }
        }, function (err, data) {
            buildDriver(browser);
            setSize(targetW, targetH)
                .then(function () {
                    return takeScreenshots(browser);
                })
                .then(function () {
                    container.stop(function (err, data) {
                        deferred.resolve();
                    });
                });
        });
    });
    return deferred.promise;
}

['chrome', 'firefox'].reduce(function (accumulator, browser) {
    return accumulator.then(function () {
        return run(browser);
    });
}, Q()).then(function () {
    process.exit(0);
});

//////////////////////////////////////////////////////////////////////
// Build the web driver

var driver;
function buildDriver(browser) {
    console.log("Building driver for " + browser);
    var builder = new selenium.Builder().forBrowser(browser);
    if (seleniumURL) {
        builder.usingServer(seleniumURL);
    }
    driver = builder.build();
}

//////////////////////////////////////////////////////////////////////
// Set the screen size

var targetW = 1024, targetH = 768;
function setSize(reqW, reqH) {
    console.log("Setting browser size");
    var deferred = Q.defer();

    var attempts = 0;
    function _setSize(reqW, reqH) {
        driver.manage().window().setSize(reqW, reqH).then(function() {
            return driver.takeScreenshot();
        }).then(function(img) {
            img = imageDimensions(img);
            if (img.width === targetW && img.height === targetH) {
                deferred.resolve();
            }
            if (++attempts > 5) {
                deferred.reject(
                    new Error("Failed to set window size correctly."));
            }
            _setSize(targetW + reqW - img.width, targetH + reqH - img.height);
        });
    }
    _setSize(reqW, reqH);

    return deferred.promise;
}

function imageDimensions(img) {
    var buf = new Buffer(img, "base64");
    var ihdr = buf.readUInt32BE(12);
    if (ihdr !== 0x49484452) {
        throw new Error("PNG IHDR not in expected location.");
    }
    var width = buf.readUInt32BE(16);
    var height = buf.readUInt32BE(20);
    return {
        buf: buf,
        width: width,
        height: height
    };
}

//////////////////////////////////////////////////////////////////////
// Take the screenshots

function takeScreenshots(browser) {
    console.log("Taking screenshots");
    return listOfCases.reduce(function (soFar, key) {
        return soFar.then(function () {
            return takeScreenshot(key, browser);
        });
    }, Q());
}

var writeFile = denodeify(fs.writeFile);

function takeScreenshot(key, browser) {
    var url = data[key];
    if (!url) {
        console.error("Test case " + key + " not known!");
        return;
    }
    url = katexURL + url.substr(toStrip.length);
    driver.get(url);

    return driver.takeScreenshot().then(function haveScreenshot(img) {
        img = imageDimensions(img);
        if (img.width !== targetW || img.height !== targetH) {
            throw new Error("Excpected " + targetW + " x " + targetH +
                            ", got " + img.width + "x" + img.height);
        }
        if (key === "Lap" && browser === "firefox" &&
            img.buf[0x32] === 0xf8) {
            /* There is some strange non-determinism with this case,
             * causing slight vertical shifts.  The first difference
             * is at offset 0x32, where one file has byte 0xf8 and
             * the other has something else.  By using a different
             * output file name for one of these cases, we accept both.
             */
            key += "_alt";
        }
        var file = path.join(dstDir, key + "-" + browser + ".png");
        console.log(file);
        return writeFile(file, img.buf);
    });
}
