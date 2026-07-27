*Please Note I am a student I will try to keep this updated to the best of my abilty.Any issues can be opened on Github :)*

Additional Module for MagicMirror²  https://github.com/MichMich/MagicMirror


# Module: UKNationalRailDarwin
This module displays LIVE train departures from the specified station(s), using National Rail's **Darwin** real-time data feed (via the OpenLDBWS SOAP service).

> **Note:** this module previously used TransportAPI, which is no longer usable. It now talks directly to Darwin/OpenLDBWS instead.

## Using the module

Git clone from this repository into the modules sub-directory of the Magic Mirror installation, change directory into the newly cloned code and then run npm install.

```bash
git clone https://github.com/Tea-4-Two/MMM-UKNationalRailDarwin.git
cd MMM-UKNationalRailDarwin
```
To use this module, add it to the modules array in the `config/config.js` file:

```javascript
modules: [
    {
		module: 		'MMM-UKNationalRailDarwin',
		position: 		'bottom_left',
		header:			'Departures',		//Optional - delete this line to turn OFF the header completely
		config: {
			stationCode: 		'SUR', 		// CRS code for station
			accessToken: 		'', 		// Darwin Consumer key (see "Getting a Darwin Consumer key" below)
			maxResults: 		5,  		//Optional - Maximum results to display.
			showOrigin: 		false   	//Optional - Show the origin of the train in the table
		}
	},
]
```
There are 2 MANDATORY fields - `stationCode` and `accessToken`. All the others are used to limit the amount of info you get back, especially useful for busy stations like Clapham Junction.

Add a config for each station you require info on.
## updates can simply be made with git pull

## Getting a Darwin Consumer key

Darwin used to be self-service via `realtime.nationalrail.co.uk`, but that portal (along with the older National Rail Data Portal) was retired in early 2026. Access is now issued through the **Rail Data Marketplace (RDM)**:

1. Create an account and sign in at [raildata.org.uk](https://raildata.org.uk/).
2. Open the Data Product Catalogue and search for **LDB**.
3. Subscribe to **"Live Departure Board"** and accept the licence - the free, open tier is approved instantly.
   - Don't pick "Live Fastest Departure Boards" or the Staff version - this module talks to the classic public GetDepBoardWithDetails SOAP service.
4. Go to **My Subscriptions**, open the subscribed product(click the name of it), and on the **Specification** tab copy the **Consumer key**.
	Possible reasons this doesnt work:
	There may be an email confirmation
	If you see a loading icon after clicking into the product the key is still generating make sure the above ^ is completed and check again in a couple minutes 
5. Paste that value into `accessToken` in your config.

If you already have an old, still-valid OpenLDBWS token from the previous registration system, that will continue to work in the `accessToken` field too.(maybe i haven't checked....)

The free tier allows 100,000 calls/month, which is far more than a single MagicMirror install polling every 5 minutes will ever use.

## Configuration options

|Option|Description|
|---|---|
|`stationCode`|String. The CRS code of the station you want departures for. **REQUIRED**. <br />**Example**: SUR|
|`accessToken`|String. Your Darwin Consumer key from the Rail Data Marketplace. **REQUIRED**.|
|`filterCrs`|String. CRS code of another station to filter services by (only show trains that call at this station). **Optional**.<br/>**Example**: WAT|
|`filterType`|String. `'to'` or `'from'` - whether `filterCrs` is a destination or an origin filter. Only used when `filterCrs` is set.<br/><br/>**Default:** 'to'|
|`timeOffset`|String. Minutes relative to now to start the results window. **Optional**.<br/><br/>**Example**: '-30'|
|`timeWindow`|String. Size of the results window, in minutes. Darwin's own default is 120 minutes if omitted. **Optional**.|
|`maxResults`|Integer. Limits the number of rows returned by the module.<br/><br/>**Default:** 5|
|`showOrigin`|Boolean. Shows the origin of the train in the results grid.<br/><br/>**Default:** false|
|`showPlatform`|Boolean. Shows the platform number of the train in the results grid. If no platform is specified it will show '-'.<br/><br/>**Default:** true|
|`showActualDeparture`|Boolean. Shows the live/revised departure time alongside the scheduled time, when Darwin has one.<br/><br/>**Default:** true|

To find the CRS Station codes for the 'stations of interest' go here: http://www.railwaycodes.org.uk/crs/CRS0.shtm or use OpenStreetMap. Information on using OpenStreetMap is found in the CRS.md file in this repo.

## Troubleshooting

If there are issues getting data out of the module, check the following:

1. Do you have an account set up at raildata.org.uk?
2. Are you subscribed to the "Live Departure Board" product?
3. Have you copied the Consumer key from that subscription's Specification tab into `accessToken`?
4. Do you know the CRS code for the station?
5. Set `debug: true` in your config - the module will log the raw SOAP request/response to the console, which usually makes auth vs. data-shape problems obvious.
6. A 401/403 from Darwin almost always means the Consumer key is missing, wrong, or the subscription hasn't been approved yet.
7. Check your subsciption has been renewed
8. is there blank spaces between the quotations 
9. have you added "UKNationalRailDarwin" to your module list at the top of config.js aswell
