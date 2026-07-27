/* Live Station Info */

/* Magic Mirror
 * Module: UK National Rail Darwin
 *
 * Talks to National Rail's Darwin data via the LDBWS REST API on the
 * Rail Data Marketplace (raildata.org.uk), authenticated with a Consumer
 * key sent as the "x-apikey" header. See README.md for how to get one.
 */

var NodeHelper = require("node_helper");
var https = require("https");
var URL = require("url").URL;

module.exports = NodeHelper.create({
  start: function () {
    console.log("MMM-UKNationalRailDarwin helper started ...");
  },

  /* buildUrl(params)
   * Builds the full LDBWS REST request URL, including the CRS path
   * parameter and any optional query parameters.
   */
  buildUrl: function (params) {
    var base = params.apiBase || "https://api1.raildata.org.uk/1010-live-departure-board-dep1_2/LDBWS/api/20220120/GetDepartureBoard/";

    // Make sure there's exactly one slash between the base and the CRS code.
    if (base.charAt(base.length - 1) !== "/") {
      base += "/";
    }

    var url = new URL(base + encodeURIComponent(params.stationCode));

    if (params.numRows) {
      url.searchParams.set("numRows", params.numRows);
    }
    if (params.filterCrs) {
      url.searchParams.set("filterCrs", params.filterCrs);
      url.searchParams.set("filterType", params.filterType || "to");
    }
    if (params.timeOffset) {
      url.searchParams.set("timeOffset", params.timeOffset);
    }
    if (params.timeWindow) {
      url.searchParams.set("timeWindow", params.timeWindow);
    }

    return url;
  },

  /* getTimetable(params)
   * Sends a GET request to the LDBWS REST API and sends the parsed JSON
   * (or an error) back to the module via socket.
   */
  getTimetable: function (params) {
    var self = this;
    var target;

    try {
      target = this.buildUrl(params);
    } catch (e) {
      self.sendSocketNotification("TRAIN_ERROR", {
        identifier: params.identifier,
        error: "Invalid Darwin API URL configured"
      });
      return;
    }

    if (params.debug) {
      console.log("MMM-UKNationalRailDarwin: requesting " + target.toString());
    }

    var options = {
      hostname: target.hostname,
      path: target.pathname + target.search,
      method: "GET",
      headers: {
        "x-apikey": params.accessToken,
        Accept: "application/json"
      }
    };

    var req = https.request(options, function (res) {
      var body = "";
      res.setEncoding("utf8");
      res.on("data", function (chunk) {
        body += chunk;
      });
      res.on("end", function () {
        if (res.statusCode === 401 || res.statusCode === 403) {
          self.sendSocketNotification("TRAIN_ERROR", {
            identifier: params.identifier,
            error:
              "Darwin rejected the request (HTTP " + res.statusCode + "). " +
              "Check your Consumer key from raildata.org.uk (My Subscriptions -> LDBWS product -> API access credentials)."
          });
          return;
        }

        if (res.statusCode === 404) {
          self.sendSocketNotification("TRAIN_ERROR", {
            identifier: params.identifier,
            error: "Darwin returned 404 - check the stationCode (CRS) and the API base URL are correct."
          });
          return;
        }

        if (res.statusCode !== 200) {
          self.sendSocketNotification("TRAIN_ERROR", {
            identifier: params.identifier,
            error: "Darwin returned HTTP " + res.statusCode
          });
          return;
        }

        var data;
        try {
          data = JSON.parse(body);
        } catch (err) {
          self.sendSocketNotification("TRAIN_ERROR", {
            identifier: params.identifier,
            error: "Couldn't parse the response from Darwin"
          });
          return;
        }

        if (params.debug) {
          console.log(JSON.stringify(data, null, 2));
        }

        self.sendSocketNotification("TRAIN_DATA", {
          identifier: params.identifier,
          data: data
        });
      });
    });

    req.on("error", function (error) {
      self.sendSocketNotification("TRAIN_ERROR", {
        identifier: params.identifier,
        error: "Request to Darwin failed: " + error.message
      });
    });

    req.end();
  },

  // Subclass socketNotificationReceived received.
  socketNotificationReceived: function (notification, payload) {
    if (notification === "GET_TRAININFO") {
      this.getTimetable(payload);
    }
  }
});