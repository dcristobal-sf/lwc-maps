import { LightningElement, track, api, wire } from 'lwc';
import leaflet from '@salesforce/resourceUrl/leaflet_1_5_1';
import { loadStyle, loadScript } from 'lightning/platformResourceLoader';
import { subscribe } from 'lightning/empApi';

/** Use Apex to fetch related records. */
import { refreshApex } from '@salesforce/apex';
/** getPlaces() method in PlaceController Apex class */
import getPlaces from '@salesforce/apex/TAT_AirportController.getAirports';
/** Pub-sub mechanism for sibling component communication. */
import { registerListener, unregisterAllListeners, fireEvent } from 'c/pubsub';


const BLUE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 52 52"><path fill="#3333CC" d="m26 2c-10.5 0-19 8.5-19 19.1 0 13.2 13.6 25.3 17.8 28.5 0.7 0.6 1.7 0.6 2.5 0 4.2-3.3 17.7-15.3 17.7-28.5 0-10.6-8.5-19.1-19-19.1z m0 27c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8z"></path></svg>';
const RED_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 52 52"><path fill="#DB4437" d="m26 2c-10.5 0-19 8.5-19 19.1 0 13.2 13.6 25.3 17.8 28.5 0.7 0.6 1.7 0.6 2.5 0 4.2-3.3 17.7-15.3 17.7-28.5 0-10.6-8.5-19.1-19-19.1z m0 27c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8z"></path></svg>';
const SELECTED_MARKER_CLASS = 'marker-selected';

export default class LeafletMap extends LightningElement {
	@track channelName = '/data/Place__ChangeEvent';
	@api latitude = 37.135277;
	@api longitude = -3.6242785;
	//@api markers = [{ latitude: 37.135277, longitude: -3.6242785},{ latitude: 37.1382467, longitude: -3.6266562}];

	@track librariesLoaded = false;
	//@track places;
	
	connectedCallback() {
		this.handleSubscribe();
	}
	
	/** All available Place__c[]. */
	_places = [];

    @api
    get places() {
        return this._places;
    }
    set places(value) {
        this._places = value;
    }
	
	getIcon(value) {
		/*if (value.Status__c === 'Red') {
			return window.L.divIcon({
				className: '',
				html: RED_ICON
			});
		} else if (value.Status__c === 'Blue'){
			return window.L.divIcon({
				className: '',
				html: BLUE_ICON
			});
		} */
		return window.L.divIcon({
			className: '',
			html: value.LocationIcon__c
		});
	}

	leafletMap = null;
	leafletMarkers = [];
	creatingSelection = false;

	/**
     * Load the list of available places.
     */
	wiredPlacesResult;

	@wire(getPlaces)
	wiredPlaces(result) {
		this.wiredPlacesResult = result;
        if (result.data) {
			this.places = result.data;
			this.renderMap();
            console.log(JSON.stringify(this.places));
			this.error = undefined;
		}
    }
	
	// Handles subscribe button click
	handleSubscribe() {
		// Callback invoked whenever a new event message is received
		const messageCallback = (response) => {
			console.log('New message received : ', JSON.stringify(response));
			// Response contains the payload of the new message received
			this.removeMap();
		};

		// Invoke subscribe method of empApi. Pass reference to messageCallback
		subscribe(this.channelName, -1, messageCallback).then(response => {
			// Response contains the subscription information on successful subscribe call
			console.log('Successfully subscribed to : ', JSON.stringify(response.channel));
		});
	}

	renderedCallback() {
		Promise.all([
			loadScript(this, leaflet + '/leaflet.js'),
			loadStyle(this, leaflet + '/leaflet.css')
		])
		.then(() => {
			this.librariesLoaded = true;
			this.renderMap();
		})
		.catch(error => {
			alert('Error:' + error.message);
		});
	}

	removeMap() {
		if (this.leafletMap ){
			this.leafletMap.eachLayer(function(layer){
				layer.remove();
			});
			this.leafletMap.remove();
			this.leafletMap = null;
		}
		refreshApex(this.wiredPlacesResult);
	}

	renderMap() {
		console.log('Pre-rendering....');
		const mapElement = this.template.querySelector('div.map');
		if (mapElement !== null && !mapElement.hasChildNodes() && this.places.length > 0) {
			console.log('Rendering....');
			// Create map
			this.leafletMap = window.L.map(mapElement, {zoomControl: true, tap: false });
			this.leafletMap.on('draw:created', this.handleFinishSelection, this);

			// Add tile (background)
			window.L.tileLayer('https://a.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: 'Tiles © OpenStreetMap contributors'
			}).addTo(this.leafletMap);

			// Add markers
			if (this.places.length > 0) {
				const defaultIcon = window.L.divIcon({
					className: '',
					html: RED_ICON
				});

				this.places.forEach(place => {
					const leafletMarker = window.L.marker([place.Location__Latitude__s, place.Location__Longitude__s], {icon: this.getIcon(place), riseOnHover:true, markerId: place.Id});
					//const popUpContent = `Property Blablablah. <a target="_blank" href="http://www.google.com/maps?layer=c&cbll=${marker.latitude},${marker.longitude}"></a>`;
					//leafletMarker.bindPopup(popUpContent).openPopup();
					this.leafletMarkers.push(leafletMarker);
				});

				const allMarkersGroup = new window.L.featureGroup(this.leafletMarkers);
				allMarkersGroup.on('contextmenu', this.handleMarkerRightClick, this);
				allMarkersGroup.addTo(this.leafletMap);
				this.leafletMap.fitBounds(allMarkersGroup.getBounds().pad(0.1));
			}
		}
	}

	handleMarkerRightClick(event) {
		if (window.L !== undefined) {
			const markerSelected = event.sourceTarget._icon.classList.contains(SELECTED_MARKER_CLASS);

			const newIcon = window.L.divIcon({
				className: markerSelected? '' : SELECTED_MARKER_CLASS,
				html: markerSelected? RED_ICON : BLUE_ICON
			});
			event.sourceTarget.setIcon(newIcon);
			//alert('Clicked: ' + JSON.stringify(event.latlng) + ' with Id: ' + JSON.stringify(event.sourceTarget.options.markerId));
		}
	}
}