/* Timetable for Trains Module */

/* Magic Mirror
 * Module: UK National Rail
 *
 * Updated to use National Rail's Darwin real-time feed via OpenLDBWS,
 * since TransportAPI (the module's original data source) is no longer
 * usable. See README.md for how to get a Darwin Consumer key.
 */

Module.register("MMM-UKNationalRailDarwin", {

    // Define module defaults
    defaults: {
        updateInterval: 5 * 60 * 1000, // Update every 5 minutes.
        animationSpeed: 2000,
        fade: true,
        fadePoint: 0.25, // Start on 1/4th of the list.
        initialLoadDelay: 0, // start delay seconds.

        // Darwin/OpenLDBWS SOAP endpoint. You shouldn't normally need to change this.
        soapEndpoint: 'https://lite.realtime.nationalrail.co.uk/OpenLDBWS/ldb11.asmx',

        stationCode: '', // CRS code for the station you want departures from
        accessToken: '', // Darwin "Consumer key" from the Rail Data Marketplace (raildata.org.uk)

        filterCrs: '', // Optional - CRS code of another station to filter services by
        filterType: 'to', // 'to' or 'from' - only used if filterCrs is set
        timeOffset: '', // Optional - minutes relative to now to start the window (e.g. '-30')
        timeWindow: '', // Optional - size of the time window in minutes (Darwin default is 120)

        maxResults: 5, //Optional - Maximum results to display.
        showOrigin: false, //Optional - Show the origin of the train in the table
        showPlatform: true, //Optional - Show the departure platform of the train in the table
        showActualDeparture: true, //Optional - Show the real-time departure time in the table

        debug: false
    },

    // Define required scripts.
    getStyles: function() {
        return ["trains.css", "font-awesome.css"];
    },

    // Define required scripts.
    getScripts: function() {
        return ["moment.js", this.file('titleCase.js')];
    },

    //Define header for module.
    getHeader: function() {
        return this.data.header;
    },

    // Define start sequence.
    start: function() {
        Log.info("Starting module: " + this.name);

        // Set locale.
        moment.locale(config.language);

        this.trains = {};
        this.loaded = false;
        this.errorMessage = null;

        // Initial start up delay via a timeout
        this.updateTimer = setTimeout(() => {
            this.fetchTrainInfo();

            // Now we've had our initial delay, re-fetch our train information at the interval given in the config
            this.updateTimer = setInterval(() => {
                this.fetchTrainInfo();
            }, this.config.updateInterval);

        }, this.config.initialLoadDelay);
    },

    // Trigger an update of our train data
    fetchTrainInfo: function() {
        if (!this.hidden) {
            this.sendSocketNotification("GET_TRAININFO", {
                identifier: this.identifier,
                endpoint: this.config.soapEndpoint,
                accessToken: this.config.accessToken,
                stationCode: this.config.stationCode,
                filterCrs: this.config.filterCrs,
                filterType: this.config.filterType,
                timeOffset: this.config.timeOffset,
                timeWindow: this.config.timeWindow,
                numRows: this.config.maxResults,
                debug: this.config.debug
            });
        }
    },

    // Override dom generator.
    getDom: function() {
        var wrapper = document.createElement("div");

        if (this.config.stationCode === "") {
            wrapper.innerHTML = "Please set the Station Code (CRS) in the config.";
            wrapper.className = "dimmed light small";
            return wrapper;
        }

        if (this.config.accessToken === "") {
            wrapper.innerHTML = "Please set your Darwin accessToken (Consumer key from raildata.org.uk) in the config.";
            wrapper.className = "dimmed light small";
            return wrapper;
        }

        if (this.errorMessage) {
            wrapper.innerHTML = this.errorMessage;
            wrapper.className = "dimmed light small";
            return wrapper;
        }

        if (!this.loaded) {
            wrapper.innerHTML = "Loading trains ...";
            wrapper.className = "dimmed light small";
            return wrapper;
        }

        //Dump train data
        if (this.config.debug) {
            Log.info(this.trains);
        }

        // *** Start Building Table
        var table = document.createElement("table");
        table.className = "small";

        //With data returned
        if (this.trains.data.length > 0) {
            for (var t in this.trains.data) {
                var myTrain = this.trains.data[t];

                //Create row for data item
                var row = document.createElement("tr");
                table.appendChild(row);

                //If platform is required, create first table cell
                if (this.config.showPlatform) {
                    var platform;
                    if (myTrain.platform) {
                        platform = myTrain.platform;
                    } else {
                        platform = '-';
                    }

                    var trainPlatformCell = document.createElement("td");
                    trainPlatformCell.innerHTML = " " + platform + " ";
                    trainPlatformCell.className = "platform";
                    row.appendChild(trainPlatformCell);
                }

                //Train destination cell
                var trainDestCell = document.createElement("td");
                trainDestCell.innerHTML = myTrain.destination;
                trainDestCell.className = "bright dest";
                row.appendChild(trainDestCell);

                //If required train origin cell
                if (this.config.showOrigin) {
                    var trainOriginCell = document.createElement("td");
                    trainOriginCell.innerHTML = myTrain.origin;
                    trainOriginCell.className = "trainOrigin";
                    row.appendChild(trainOriginCell);
                }

                //Timetabled departure time
                var plannedDepCell = document.createElement("td");
                plannedDepCell.innerHTML = myTrain.plannedDeparture;
                plannedDepCell.className = "timeTabled";
                row.appendChild(plannedDepCell);

                //If required, live departure time (only shown when Darwin gives a revised time)
                if (this.config.showActualDeparture) {
                    var actualDepCell = document.createElement("td");
                    if (myTrain.actualDeparture != null) {
                        actualDepCell.innerHTML = "(" + myTrain.actualDeparture + ")";
                    } else {
                        actualDepCell.innerHTML = "&nbsp;";
                    }
                    actualDepCell.className = "actualTime";
                    row.appendChild(actualDepCell);
                }

                //Train status cell
                var statusCell = document.createElement("td");
                statusCell.innerHTML = " " + titleCase(myTrain.status) + " ";

                var statusUpper = myTrain.status.toUpperCase();
                if (statusUpper === "ON TIME") {
                    statusCell.className = "bright nonews status";
                } else if (statusUpper === "CANCELLED") {
                    statusCell.className = "late status";
                } else if (statusUpper === "DELAYED") {
                    statusCell.className = "late status";
                } else if (statusUpper === "LATE") {
                    statusCell.className = "bright late status";
                } else if (statusUpper === "EARLY") {
                    statusCell.className = "bright early status";
                } else if (statusUpper === "NO REPORT") {
                    statusCell.className = "nonews status";
                } else {
                    // A revised HH:MM time from Darwin that we couldn't
                    // confidently classify as late/early.
                    statusCell.className = "bright late status";
                }

                row.appendChild(statusCell);

                if (this.config.fade && this.config.fadePoint < 1) {
                    if (this.config.fadePoint < 0) {
                        this.config.fadePoint = 0;
                    }
                    var startingPoint = this.trains.data.length * this.config.fadePoint;
                    var steps = this.trains.data.length - startingPoint;
                    if (t >= startingPoint) {
                        var currentStep = t - startingPoint;
                        row.style.opacity = 1 - (1 / steps * currentStep);
                    }
                }
            }
        } else {
            var row1 = document.createElement("tr");
            table.appendChild(row1);

            var messageCell = document.createElement("td");
            messageCell.innerHTML = " " + this.trains.message + " ";
            messageCell.className = "bright";
            row1.appendChild(messageCell);

            var row2 = document.createElement("tr");
            table.appendChild(row2);

            var timeCell = document.createElement("td");
            timeCell.innerHTML = " " + this.trains.timestamp + " ";
            timeCell.className = "bright";
            row2.appendChild(timeCell);
        }

        wrapper.appendChild(table);
        // *** End building results table

        return wrapper;
    },

    /* firstOf(node, path)
     * Small helper for safely digging into the deeply-nested, array-heavy
     * structure that xml2js produces from Darwin's SOAP response.
     * `path` is an array of keys to walk, taking element [0] at each step.
     */
    firstOf: function(node, path) {
        var current = node;
        for (var i = 0; i < path.length; i++) {
            if (current == null) {
                return null;
            }
            current = current[path[i]];
            if (Array.isArray(current)) {
                current = current[0];
            }
        }
        return current == null ? null : current;
    },

    /* processTrains(result)
     * Uses the parsed Darwin SOAP response (via xml2js, prefixes stripped)
     * to populate this.trains for getDom() to render.
     *
     * argument result object - Parsed GetDepBoardWithDetailsResponse from Darwin.
     */
    processTrains: function(result) {

        this.trains = {};
        this.trains.data = [];
        this.trains.timestamp = new Date();
        this.trains.message = null;

        var fault = this.firstOf(result, ["Envelope", "Body", "Fault"]);
        if (fault) {
            var faultString = this.firstOf(fault, ["faultstring"]) || "Darwin returned a fault";
            this.trains.message = faultString;
            this.loaded = true;
            this.updateDom(this.config.animationSpeed);
            return;
        }

        var board = this.firstOf(result, ["Envelope", "Body", "GetDepBoardWithDetailsResponse", "GetStationBoardResult"]);

        if (!board) {
            this.trains.message = "No info about the station returned";
            if (this.config.debug) {
                Log.error("MMM-UKNationalRail: unexpected response shape", result);
            }
            this.loaded = true;
            this.updateDom(this.config.animationSpeed);
            return;
        }

        this.trains.stationName = this.firstOf(board, ["locationName"]) || "Departures";

        // firstOf collapses to a single item, so pull the full array out directly.
        var serviceList = (board.trainServices && board.trainServices[0] && board.trainServices[0].service) || [];

        if (serviceList.length > 0) {

            var counter = this.config.maxResults > serviceList.length ? serviceList.length : this.config.maxResults;

            for (var i = 0; i < counter; i++) {
                var thisTrain = serviceList[i];

                var std = this.firstOf(thisTrain, ["std"]);
                var etd = this.firstOf(thisTrain, ["etd"]);
                var platform = this.firstOf(thisTrain, ["platform"]);
                var originName = this.firstOf(thisTrain, ["origin", "location", "locationName"]);
                var destinationName = this.firstOf(thisTrain, ["destination", "location", "locationName"]);

                // Darwin gives etd as "On time", "Delayed", "Cancelled", "No report",
                // or a revised HH:MM time. Only show a separate "actual" time when
                // it's a genuine revised time (i.e. not one of the status words).
                var statusWords = ["ON TIME", "DELAYED", "CANCELLED", "NO REPORT"];
                var actualDeparture = null;
                var status = etd || "No report";

                if (etd && statusWords.indexOf(etd.toUpperCase()) === -1) {
                    // etd is a revised time like "14:32"
                    actualDeparture = etd;
                    status = (etd !== std) ? etd : "On time";
                }

                this.trains.data.push({
                    plannedDeparture: std,
                    actualDeparture: actualDeparture,
                    status: status,
                    origin: originName,
                    destination: destinationName,
                    platform: platform
                });
            }
        } else {
            this.trains.message = "No departures found";
        }

        this.loaded = true;
        this.updateDom(this.config.animationSpeed);
    },

    // Process data returned
    socketNotificationReceived: function(notification, payload) {

        if (payload.identifier !== this.identifier) {
            return;
        }

        if (notification === 'TRAIN_DATA') {
            this.errorMessage = null;
            this.processTrains(payload.data);
        } else if (notification === 'TRAIN_ERROR') {
            this.errorMessage = payload.error;
            this.loaded = true;
            this.updateDom(this.config.animationSpeed);
        }
    }

});