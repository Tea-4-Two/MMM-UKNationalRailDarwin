/* Live Station Info 
 * Updated to talk to National Rail's Darwin real-time data feed via the
 * OpenLDBWS SOAP service, since TransportAPI is no longer usable.
 *
 * You'll need a Darwin "Consumer key" from the Rail Data Marketplace
 * (raildata.org.uk) - subscribe to "Live Departure Board Web Service
 * (LDBWS) - Public" and copy the Consumer key from the subscription's
 * Specification tab. See README.md for the full walkthrough.
 */

var NodeHelper = require("node_helper");
var https = require("https");
var URL = require("url").URL;
var xml2js = require("xml2js");

var LDB_NAMESPACE = "http://thalesgroup.com/RTTI/2017-10-01/ldb/";
var TOKEN_NAMESPACE = "http://thalesgroup.com/RTTI/2013-11-28/Token/types";
var SOAP_ACTION = "http://thalesgroup.com/RTTI/2017-10-01/ldb/GetDepBoardWithDetails";

module.exports = NodeHelper.create({
  start: function () {
    console.log("MMM-UKNationalRail helper started ...");
  },

  /* buildSoapEnvelope(params)
   * Builds the SOAP XML body for a GetDepBoardWithDetails request against Darwin.
   */
  buildSoapEnvelope: function (params) {
    var filterCrsTag = "";
    var filterTypeTag = "";

    // filterType/filterCrs only make sense together - Darwin ignores
    // filterType if there's no filterCrs to go with it.
    if (params.filterCrs) {
      filterCrsTag = "<ldb:filterCrs>" + this.escapeXml(params.filterCrs) + "</ldb:filterCrs>";
      filterTypeTag = "<ldb:filterType>" + this.escapeXml(params.filterType || "to") + "</ldb:filterType>";
    }

    var timeOffsetTag = params.timeOffset ? "<ldb:timeOffset>" + this.escapeXml(params.timeOffset) + "</ldb:timeOffset>" : "";
    var timeWindowTag = params.timeWindow ? "<ldb:timeWindow>" + this.escapeXml(params.timeWindow) + "</ldb:timeWindow>" : "";

    return (
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" ' +
      'xmlns:typ="' + TOKEN_NAMESPACE + '" ' +
      'xmlns:ldb="' + LDB_NAMESPACE + '">' +
      "<soap:Header>" +
      "<typ:AccessToken><typ:TokenValue>" + this.escapeXml(params.accessToken) + "</typ:TokenValue></typ:AccessToken>" +
      "</soap:Header>" +
      "<soap:Body>" +
      "<ldb:GetDepBoardWithDetailsRequest>" +
      "<ldb:numRows>" + parseInt(params.numRows, 10) + "</ldb:numRows>" +
      "<ldb:crs>" + this.escapeXml(params.stationCode) + "</ldb:crs>" +
      filterCrsTag +
      filterTypeTag +
      timeOffsetTag +
      timeWindowTag +
      "</ldb:GetDepBoardWithDetailsRequest>" +
      "</soap:Body>" +
      "</soap:Envelope>"
    );
  },

  escapeXml: function (value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  },

  /* getTimetable(params)
   * Sends a GetDepBoardWithDetails SOAP request to Darwin/OpenLDBWS and
   * sends the parsed response (or an error) back to the module via socket.
   */
  getTimetable: function (params) {
    var self = this;
    var endpoint = params.endpoint || "https://lite.realtime.nationalrail.co.uk/OpenLDBWS/ldb11.asmx";
    var soapBody = this.buildSoapEnvelope(params);

    if (params.debug) {
      console.log("MMM-UKNationalRail: sending SOAP request to " + endpoint);
      console.log(soapBody);
    }

    var target;
    try {
      target = new URL(endpoint);
    } catch (e) {
      self.sendSocketNotification("TRAIN_ERROR", {
        identifier: params.identifier,
        error: "Invalid Darwin endpoint configured: " + endpoint
      });
      return;
    }

    var options = {
      hostname: target.hostname,
      path: target.pathname + target.search,
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "Content-Length": Buffer.byteLength(soapBody),
        SOAPAction: SOAP_ACTION
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
              "Check your Consumer key from raildata.org.uk (My Subscriptions -> LDBWS - Public -> Specification)."
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

        var parser = new xml2js.Parser({
          explicitArray: true,
          tagNameProcessors: [xml2js.processors.stripPrefix]
        });

        parser.parseString(body, function (err, result) {
          if (err) {
            self.sendSocketNotification("TRAIN_ERROR", {
              identifier: params.identifier,
              error: "Couldn't parse the response from Darwin"
            });
            return;
          }

          if (params.debug) {
            console.log(JSON.stringify(result, null, 2));
          }

          self.sendSocketNotification("TRAIN_DATA", {
            identifier: params.identifier,
            data: result
          });
        });
      });
    });

    req.on("error", function (error) {
      self.sendSocketNotification("TRAIN_ERROR", {
        identifier: params.identifier,
        error: "Request to Darwin failed: " + error.message
      });
    });

    req.write(soapBody);
    req.end();
  },

  // Subclass socketNotificationReceived received.
  socketNotificationReceived: function (notification, payload) {
    if (notification === "GET_TRAININFO") {
      this.getTimetable(payload);
    }
  }
});