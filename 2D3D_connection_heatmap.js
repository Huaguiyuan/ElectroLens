import {initializeViewSetups} from "./MultiviewControl/initializeViewSetups.js";
import {initialize2DHeatmapSetup} from "./2DHeatmaps/initialize2DHeatmapSetup.js";
import {calculateViewportSizes} from "./MultiviewControl/calculateViewportSizes.js";

import {arrangeDataToHeatmap, getHeatmap, updateHeatmap, replotHeatmap} from "./2DHeatmaps/HeatmapView.js";
import {getPointCloudGeometry, updatePointCloudGeometry, changePointCloudGeometry,animatePointCloudGeometry} from "./3DViews/PointCloud_selection.js";
import {addSystemEdge} from "./3DViews/systemEdge.js";
import {readCSV,readCSV2/*,readCSVPapaparse, readViewsSetup*/} from "./Utilities/readDataFile.js";

import {setupOptionBox3DView} from "./3DViews/setupOptionBox3DView.js";
import {setupOptionBox2DHeatmap} from "./2DHeatmaps/setupOptionBox2DHeatmap.js";

import {setupViewCameraSceneController } from "./MultiviewControl/setupViewBasic.js";
import {addOptionBox, updateOptionBoxLocation, showHideAllOptionBoxes } from "./MultiviewControl/optionBoxControl.js";
import {setupHUD} from "./MultiviewControl/HUDControl.js";
import {updateController} from "./MultiviewControl/controllerControl.js";
import {getAxis, addTitle, update2DHeatmapTitlesLocation} from "./2DHeatmaps/Utilities.js";
import {initializeHeatmapToolTip,updateHeatmapTooltip} from "./2DHeatmaps/tooltip.js";

import {fullscreenOneView} from "./MultiviewControl/calculateViewportSizes.js";

import {insertLegend, removeLegend, changeLegend} from "./MultiviewControl/colorLegend.js";

import {calcDefaultColorScales, adjustColorScaleAccordingToDefault} from "./Utilities/colorScale.js";

console.log('starting');
var uploader = document.getElementById("uploader");
console.log(uploader);
var uploader_wrapper = document.getElementById("uploader_wrapper");

uploader.addEventListener("change", handleFiles, false);

function handleFiles() {
    var file = this.files[0];
    console.log(file);
    console.log(this);
    $.ajax({
    	url: file.path,
    	dataType: 'json',
    	type: 'get',
    	cache: false,
    	success: function(data) {
    		var views = data.views;
    		var plotSetup = data.plotSetup;
    		uploader.parentNode.removeChild(uploader);
    		uploader_wrapper.parentNode.removeChild(uploader_wrapper);
    		initializeViewSetups(views,plotSetup);
    		main(views,plotSetup);
    	},
    	error: function(requestObject, error, errorThrown) {
            alert(error);
            alert(errorThrown);
        }
    })
}


function main(views,plotSetup) {

	if ( ! Detector.webgl ) Detector.addGetWebGLMessage();
	var container, stats, renderer;
	var selectionPlaneMaterial = new THREE.MeshBasicMaterial( {  color: 0xffffff, opacity: 0.5,transparent: true, side: THREE.DoubleSide,needsUpdate : true } );
	var mouseX = 0, mouseY = 0;
	var windowWidth, windowHeight;
	var clickRequest = false;
	var mouseHold = false;
	
	var continuousSelection = false;
	var planeSelection = false, pointSelection = false;


	var activeView = null;

	var showOptionBoxesBool = true;

	//initializeViewSetups(views,plotSetup);

	var unfilteredData = [];
	var queue=d3.queue();

	for (var ii =  0; ii < views.length; ++ii ) {
		var view = views[ii];
		if (view.viewType == '3DView'){
			//queue.defer(readCSV,view,unfilteredData);
			queue.defer(readCSV2,view,unfilteredData,plotSetup);
			//queue.defer(readCSVPapaparse,view,unfilteredData,plotSetup);
		}			
	}

	queue.awaitAll(function(error) {
		if (error) throw error;
		init();
		animate();
	});

	function init() {
		console.log(unfilteredData)
		console.log('started initialization')
		container = document.getElementById( 'container' );
		renderer = new THREE.WebGLRenderer( { antialias: true } );
		renderer.setPixelRatio( window.devicePixelRatio );
		renderer.setSize( window.innerWidth , window.innerHeight);

		renderer.autoClear = false;
		container.appendChild( renderer.domElement );

		var defaultColorScales = calcDefaultColorScales(plotSetup,unfilteredData);

		for (var ii =  0; ii < views.length; ++ii ) {
			var view = views[ii];

			view.unfilteredData = unfilteredData;

			setupViewCameraSceneController(view,renderer);
			addOptionBox(view);
			setupHUD(view);

			view.controller.addEventListener( 'change', render );

			console.log(view.controller)

			if (view.viewType == '3DView'){
				
				view.defaultColorScales = defaultColorScales;
				adjustColorScaleAccordingToDefault(view);				

				getPointCloudGeometry(view);
				addSystemEdge(view);
				setupOptionBox3DView(view,plotSetup);
				insertLegend(view);
			}
			if (view.viewType == '2DHeatmap'){
				view.controller.enableRotate=false;
				initializeHeatmapToolTip(view);
				setupOptionBox2DHeatmap(view,plotSetup);
				getAxis(view);
				addTitle(view);

				arrangeDataToHeatmap(view,unfilteredData)
				getHeatmap(view);
				insertLegend(view);
				
			}

		}
		
		
		stats = new Stats();
		//container.appendChild( stats.dom );
		document.addEventListener( 'mousemove', onDocumentMouseMove, false );
		window.addEventListener( 'mousedown', function( event ) {
			mouseHold = true;
			if (event.button == 0){
				clickRequest = true;
			}
		}, false );
		window.addEventListener( 'mouseup', function( event ) {
			mouseHold = false;
			if (event.button == 0){
				clickRequest = false;
				if (planeSelection){
					planeSelection = false;
					var temp_view = activeView;
					if (temp_view.viewType == "2DHeatmap"){
						var temp = temp_view.scene.getObjectByName('selectionPlane');
						if (temp != null){
							//updateSelection();
							updatePlaneSelection(temp_view);
							temp_view.scene.remove(temp);
							
						} 
					}

				}
			}
		}, false );

		
		window.addEventListener( 'dblclick', function( event ) {
			selectAll();
			updateAllPlots();
			continuousSelection = false;
		}, false );

		window.addEventListener( "keydown", onKeyDown, true);


		
	}




	function onKeyDown(e){
		if (e.keyCode == 72) {showHideAllOptionBoxes(views,showOptionBoxesBool); showOptionBoxesBool = !showOptionBoxesBool;}
		if (e.keyCode == 70) {
			for (var ii =  0; ii < views.length; ++ii ) {
				var view = views[ii];
				if (view.controllerEnabled) {view.options.toggleFullscreen.call();}
			}
		}
		if (e.keyCode == 76) {
			for (var ii =  0; ii < views.length; ++ii ) {
				var view = views[ii];
				if (view.controllerEnabled) {view.options.toggleLegend.call();}
			}
		}
		if (e.keyCode == 49) {
			planeSelection = !planeSelection;
			pointSelection = false;
		}
		if (e.keyCode == 50) {
			pointSelection = !pointSelection;
			planeSelection = false;
		}
		if (e.keyCode == 107) {
			var temp_view = {
								"viewType": "2DHeatmap",
								"plotX": plotSetup.propertyList[0],
								"plotY": plotSetup.propertyList[0],
								"plotXTransform": "linear",
								"plotYTransform": "linear"
							}
			views.push(temp_view);
			initialize2DHeatmapSetup(temp_view,views,plotSetup);
			calculateViewportSizes(views);

			temp_view.unfilteredData = unfilteredData;

			setupViewCameraSceneController(temp_view,renderer);
			addOptionBox(temp_view);
			setupHUD(temp_view);

			
			temp_view.controller.enableRotate=false;
			initializeHeatmapToolTip(temp_view);
			setupOptionBox2DHeatmap(temp_view,plotSetup);
			getAxis(temp_view);
			addTitle(temp_view);

			arrangeDataToHeatmap(temp_view,unfilteredData)
			getHeatmap(temp_view);
			insertLegend(temp_view);
			updateOptionBoxLocation(views);
			update2DHeatmapTitlesLocation(views);
				
			
		}
	}


	function updateActiveView(views){
		for ( var ii = 0; ii < views.length; ++ii ){
			var view = views[ii];
			if (view.controllerEnabled){
				return view;
			}
		}
	}


	function onDocumentMouseMove( event ) {
		mouseX = event.clientX;
		mouseY = event.clientY;
		if (mouseHold == false){updateController(views, windowWidth, windowHeight, mouseX, mouseY);}
		activeView = updateActiveView(views);

		for ( var ii = 0; ii < views.length; ++ii ){
			var view = views[ii];
			if (view.controllerEnabled){
				var left   = Math.floor( windowWidth  * view.left );
				var top    = Math.floor( windowHeight * view.top );
				var width  = Math.floor( windowWidth  * view.width ) + left;
				var height = Math.floor( windowHeight * view.height ) + top;
				var vector = new THREE.Vector3();
			
				vector.set(	(((event.clientX-left)/(width-left)) * 2 - 1),
							(-((event.clientY-top)/(height-top)) * 2 + 1),
							0.1);
				vector.unproject( view.camera );
				var dir = vector.sub( view.camera.position ).normalize();
				var distance = - view.camera.position.z/dir.z;
				view.mousePosition = view.camera.position.clone().add( dir.multiplyScalar( distance ) );
				if (view.viewType == "2DHeatmap"){updateHeatmapTooltip(view);}
			}
		}
	}
	function updateSize() {
		if ( windowWidth != window.innerWidth || windowHeight != window.innerHeight) {
			windowWidth  = window.innerWidth;
			windowHeight = window.innerHeight;
			renderer.setSize ( windowWidth, windowHeight );

			for ( var ii = 0; ii < views.length; ++ii ){
				var view = views[ii];
					
				var left   = Math.floor( windowWidth  * view.left );
				var top    = Math.floor( windowHeight * view.top );
				var width  = Math.floor( windowWidth  * view.width );
				var height = Math.floor( windowHeight * view.height );

				view.windowLeft = left;
				view.windowTop = top;
				view.windowWidth = width;
				view.windowHeight = height;
			}

			updateOptionBoxLocation(views);
			update2DHeatmapTitlesLocation(views);
		}
	}

	function animate() {
		render();
		processClick();
		stats.update();
		requestAnimationFrame( animate );
	}

	function render() {
		updateSize();
		for ( var ii = 0; ii < views.length; ++ii ) {

			var view = views[ii];
			if (view.viewType == '3DView' && view.options.animate ) {
				animatePointCloudGeometry(view);
				view.System.geometry.attributes.size.needsUpdate = true;
			}

			//view.controller.update();
			
			var camera = view.camera;
			var left   = Math.floor( windowWidth  * view.left );
			var top    = Math.floor( windowHeight * view.top );
			var width  = Math.floor( windowWidth  * view.width );
			var height = Math.floor( windowHeight * view.height );

			view.windowLeft = left;
			view.windowTop = top;
			view.windowWidth = width;
			view.windowHeight = height;

			renderer.setViewport( left, top, width, height );
			renderer.setScissor( left, top, width, height );
			renderer.setScissorTest( true );
			renderer.setClearColor( 0xffffff, 1 ); // border color
			renderer.clearColor(); // clear color buffer
			renderer.setClearColor( view.background );
			//if (view.controllerEnabled) {renderer.setClearColor( view.controllerEnabledBackground );}
			//else {renderer.setClearColor( view.background );}

			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			renderer.clear();
			renderer.render( view.scene, camera );
			renderer.render( view.sceneHUD, view.cameraHUD );
		}
	}




	function spawnPlane(view){


		var scene = view.scene;
		var mousePosition = view.mousePosition;
		var selectionPlane = new THREE.Mesh( new THREE.PlaneBufferGeometry( 1, 1), selectionPlaneMaterial );
		selectionPlane.geometry.attributes.position.needsUpdate = true;
		var p = selectionPlane.geometry.attributes.position.array;

		var i = 0;
		p[i++] = mousePosition.x-0.01;
		p[i++] = mousePosition.y+0.01;
		p[i++] = mousePosition.z;
		p[i++] = mousePosition.x;
		p[i++] = mousePosition.y+0.01;
		p[i++] = mousePosition.z;
		p[i++] = mousePosition.x-0.01;
		p[i++] = mousePosition.y;
		p[i++] = mousePosition.z;
		p[i++] = mousePosition.x;
		p[i++] = mousePosition.y;
		p[i]   = mousePosition.z;
		
		selectionPlane.name = 'selectionPlane';
		scene.add( selectionPlane );
		//updateSelection();
	}

	function updatePlane(view, plane){
		var scene = view.scene;

		var mousePosition = view.mousePosition;
		
		var selectionPlane = new THREE.Mesh( new THREE.PlaneBufferGeometry( 1, 1), selectionPlaneMaterial );
		selectionPlane.geometry.attributes.position.needsUpdate = true;
		
		
		var pOriginal = plane.geometry.attributes.position.array;
		
		var originalFirstVerticesCoordx = pOriginal[0],
			originalFirstVerticesCoordy = pOriginal[1],
			originalFirstVerticesCoordz = pOriginal[2];
		
		var p = selectionPlane.geometry.attributes.position.array
		var i = 0;
		p[i++] = originalFirstVerticesCoordx;
		p[i++] = originalFirstVerticesCoordy;
		p[i++] = originalFirstVerticesCoordz;
		p[i++] = mousePosition.x;
		p[i++] = originalFirstVerticesCoordy;
		p[i++] = mousePosition.z;
		p[i++] = originalFirstVerticesCoordx;
		p[i++] = mousePosition.y;
		p[i++] = mousePosition.z;
		p[i++] = mousePosition.x;
		p[i++] = mousePosition.y;
		p[i]   = mousePosition.z;
		
		scene.remove(plane);
		selectionPlane.name = 'selectionPlane';
		scene.add( selectionPlane );
		//updateSelection();
		
	}

	function updateSelectionFromHeatmap(view){
		var data = view.data;
		for (var x in data){
			for (var y in data[x]){
				if (data[x][y].selected) {
					for (var i = 0; i < data[x][y]['list'].length; i++) {
						data[x][y]['list'][i].selected = true;
					}
				}
				/*else {
					for (var i = 0; i < data[x][y]['list'].length; i++) {
						data[x][y]['list'][i].selected = false;
					}
				}*/
			}
		}
	}

	function deselectAll(){
		for (var i=0; i<unfilteredData.length; i++){
				unfilteredData[i].selected = false;
			}


		for (var ii =  0; ii < views.length; ++ii ) {
			var view = views[ii];
			if (view.viewType == '2DHeatmap'){
				var data = view.data;
				for (var x in data){
					for (var y in data[x]){
						data[x][y].selected = false;
					}
				}
			}
		}
	}

	function selectAll(){
		for (var i=0; i<unfilteredData.length; i++){
				unfilteredData[i].selected = true;
			}

		for (var ii =  0; ii < views.length; ++ii ) {
			var view = views[ii];
			if (view.viewType == '2DHeatmap'){
				var data = view.data;
				for (var x in data){
					for (var y in data[x]){
						data[x][y].selected = true;
					}
				}
			}
		}
	}

	function updateAllPlots(){
		for (var ii =  0; ii < views.length; ++ii ) {
			var view = views[ii];
			if (view.viewType == '2DHeatmap'){
				updateHeatmap(view);
			}
		}
		
		for (var ii =  0; ii < views.length; ++ii ) {
			var view = views[ii];
			if (view.viewType == '3DView'){
				updatePointCloudGeometry(view);
			}
		}
	}

	function updatePlaneSelection(temp_view) {
		var tempSelectionPlane = temp_view.scene.getObjectByName('selectionPlane');
		if (tempSelectionPlane != null){
			var p = tempSelectionPlane.geometry.attributes.position.array;
			var xmin = Math.min(p[0],p[9]), xmax = Math.max(p[0],p[9]),
				ymin = Math.min(p[1],p[10]), ymax = Math.max(p[1],p[10]);
			var tempx,tempy;

			console.log('updating plane selection')
			
			var data = temp_view.data;
			var xPlotScale = temp_view.xPlotScale;
			var yPlotScale = temp_view.yPlotScale;
			for (var x in data){
				for (var y in data[x]){
					tempx = xPlotScale(parseFloat(x));
					tempy = yPlotScale(parseFloat(y));
					if (tempx>xmin && tempx<xmax && tempy>ymin && tempy<ymax){
						data[x][y].selected = true;
					}
					else { data[x][y].selected = false;}
				}
			}
			updateSelectionFromHeatmap(temp_view);							
		}	
		updateAllPlots();
	}

	function updatePointSelection(view){
		console.log(view.INTERSECTED)
		if (view.INTERSECTED != null) {
			console.log('updatePointSelection')
			var x = view.heatmapInformation[view.INTERSECTED].heatmapX;
			var y = view.heatmapInformation[view.INTERSECTED].heatmapY;
			var data = view.data;
			data[x][y].selected = true;
			updateSelectionFromHeatmap(view);
		}
		updateAllPlots();
	}

	function processClick() {
		if ( clickRequest ) {
			var view = activeView;
			if (view.viewType == '2DHeatmap'){
				//console.log(continuousSelection, planeSelection, pointSelection)
				if (continuousSelection == false /*&& (planeSelection == true || pointSelection == true)*/){
					if (planeSelection == true || pointSelection == true){
						console.log('deselect')
						deselectAll();
						updateAllPlots();
						continuousSelection = true;
					}
				}
				

				if (planeSelection){
					var temp = view.scene.getObjectByName('selectionPlane');
					if (temp != null){
						updatePlane(view,temp);
					}
					else {
						spawnPlane(view);
					}
				}

				if (pointSelection){
					updatePointSelection(view);
				}
			}
		}

	}
}