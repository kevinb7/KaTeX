"use strict";

var child_process = require("child_process");
var fs = require("fs");
var path = require("path");
var net = require("net");
var selenium = require("selenium-webdriver");

var data = require("../../test/screenshotter/ss_data.json");

var dstDir = path.normalize(
    path.join(__dirname, "..", "..", "test", "screenshotter", "images"));
var todo = Object.keys(data);
var browser, container;

//////////////////////////////////////////////////////////////////////
// Process command line arguments

switch (process.argv.length) {
case 5:
    todo = process.argv[4].split(",");
    // fall through
case 4:
    browser = process.argv[2];
    container = process.argv[3];
    break;
case 3:
    todo = process.argv[4].split(",");
    // fall through
case 2:
    browser = "firefox";
    container = null;
    break;
default:
    console.error("Usage: " + process.argv[0] + " " +
                  path.basename(process.argv[1]) +
                  " [BROWSER CONTAINER] [CASES]\n");
    console.error("BROWSER is firefox, chrome or any other browser " +
                  "supported by the selenium server.");
    console.error("CONTAINER is the name or id of a container " +
                  "running a suitable selenium image.");
    console.error("CASES is a comma-separated list of test case names.");
    console.error("\nSee the README file for details.");
    process.exit(2);
}

//////////////////////////////////////////////////////////////////////
// Work out connection to selenium docker container

function check(err) {
    if (!err) return;
    console.error(err);
    console.error(err.stack);
    process.exit(1);
}

function dockerCmd() {
    var args = Array.prototype.slice.call(arguments);
    return child_process.execFileSync(
        "docker", args, { encoding: "utf-8" }).replace(/\n$/, "");
}

var myIP, gateway, port;
if (container === null) {
    myIP = "localhost";
    gateway = port = null;
} else {
    try {
        gateway = child_process.execFileSync(
            "boot2docker", ["ip"], { encoding: "utf-8" }).replace(/\n$/, "");
        var config = child_process.execFileSync(
            "boot2docker", ["config"], { encoding: "utf-8" });
        config = (/^HostIP = "(.*)"$/m).exec(config);
        if (!config) {
            console.error("Failed to find HostIP");
            process.exit(2);
        }
        myIP = config[1];
    } catch(e) {
        myIP = gateway = dockerCmd(
            "inspect", "-f", "{{.NetworkSettings.Gateway}}", container);
    }
    port = dockerCmd("port", container, "4444");
    port = port.replace(/^0\.0\.0\.0:/, gateway + ":");
    console.log("Selenium server at " + port);
}
var toStrip = "http://localhost:7936/";
var baseURL = "http://" + myIP + ":7936/";

//////////////////////////////////////////////////////////////////////
// Wait for container to become ready

var attempts = 0;
process.nextTick(gateway ? tryConnect : buildDriver);
function tryConnect() {
    var sock = net.connect({ host: gateway, port: +port.replace(/.*:/, "") });
    sock.on("connect", function() {
        sock.end();
        attempts = 0;
        setTimeout(buildDriver, 0);
    }).on("error", function() {
        if (++attempts > 50) {
            throw new Error("Failed to connect selenium server.");
        }
        setTimeout(tryConnect, 200);
    });
}

//////////////////////////////////////////////////////////////////////
// Build the web driver

var driver;
function buildDriver() {
    var builder = new selenium.Builder().forBrowser(browser);
    if (port) builder.usingServer("http://" + port + "/wd/hub")
    driver = builder.build();
    setSize(width, height);
}

//////////////////////////////////////////////////////////////////////
// Set the screen size

var width = 1024, height = 768;
function setSize(w, h) {
    return driver.manage().window().setSize(w, h).then(function() {
        return driver.takeScreenshot();
    }).then(function(img) {
        var buf = new Buffer(img, "base64");
        var ihdr = buf.readUInt32BE(12);
        if (ihdr !== 0x49484452) {
            throw new Error("PNG IHDR not in expected location.");
        }
        var sw = buf.readUInt32BE(16);
        var sh = buf.readUInt32BE(20);
        if (sw === width && sh === height) {
            process.nextTick(takeScreenshots);
            return;
        }
        if (++attempts > 5) {
            throw new Error("Failed to set window size correctly.");
        }
        return setSize(width + w - sw, height + h - sh);
    }, check);
}

//////////////////////////////////////////////////////////////////////
// Take the screenshots

function takeScreenshots() {
    todo.forEach(takeScreenshot);
}

function takeScreenshot(key) {
    var url = data[key];
    url = baseURL + url.substr(toStrip.length);
    driver.get(url);
    driver.takeScreenshot().then(function haveScreenshot(img) {
        var buf = new Buffer(img, "base64");
        var width = buf.readUInt32BE(16);
        var height = buf.readUInt32BE(20);
        if (width !== 1024 || height !== 768) {
            throw new Error("Excpected 1024x768, got " + width + "x" + height);
        }
        var file = path.join(dstDir, key + "-" + browser + ".png");
        fs.writeFile(file, buf, check);
        console.log(key);
    }, check);
}
