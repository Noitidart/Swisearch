const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
const self = {
	name: 'Swisearch',
	id: 'Swisearch@jetpack',
	aData: 0
};

Cu.import('resource://gre/modules/Services.jsm'); 

var observers = {
	'browser-search-engine-modified': {
		aTopic: 'browser-search-engine-modified',
		observe: function (aSubject, aTopic, aData) {
			if (aData == 'engine-current') {
				console.log('current engine was changed! it is now = ', Services.search.currentEngine.name);
				//console.log('aSubject on change:', aSubject); //aSubject is the engine
				//console.log('aTopic on change:', aTopic); //aTopic is obviously `browser-search-engine-modified`
				var win = Services.wm.getMostRecentWindow('navigator:browser');
				var submissionUris = [];
				var postDatas = [];
				var engines = Services.search.getVisibleEngines();
				var switchUri;
				var switchPostData;
				engines.forEach(function(engine) {
					var submissionSub = engine.getSubmission(win.BrowserSearch.searchBar.value, null, 'searchbar');
					if (engine.name == aSubject.name) {
						//we dont want to do load switch if they change to same, which they cant, but if it matches the uri my addon will think it did
						console.log('not pushing on engine.name of', engine.name);
						switchUri = submissionSub.uri.spec;
						switchPostData = submissionSub.postData;
						return;
					}
					submissionUris.push(submissionSub.uri.spec);
				});
				var compLoc = win.gBrowser.selectedTab.linkedBrowser.contentWindow.document.location.href; //win.gBrowser.selectedTab.linkedBrowser.contentWindow.document.location.origin + win.gBrowser.selectedTab.linkedBrowser.contentWindow.document.location.search;
				console.log(compLoc, ':compLoc');
				console.log(submissionUris.join('\n'));
				console.log('indexof:', submissionUris.indexOf(compLoc));
				var foundInArr = submissionUris.indexOf(compLoc);
				if (foundInArr > -1) {
					console.log('load switch now');
					win.openLinkIn(switchUri,
							'current', {
							postData: switchPostData
						});
						
						win.BrowserSearch.searchBar._popup.hidePopup();
				}
			}
		},
		reg: function () {
			Services.obs.addObserver(observers[this.aTopic], this.aTopic, false);
		},
		unreg: function () {
			Services.obs.removeObserver(observers[this.aTopic], this.aTopic);
		}
	}
};

function midClickd(e) {
	if (e.button != 1) {
		//not middle button
		return;
	}
	var popup = this;
	//console.log('eee:', e);  
	console.log('ey:', e.target);


	var openTabForMidClick = Services.prefs.getBoolPref('browser.tabs.opentabfor.middleclick');
	if (!openTabForMidClick) {
		console.warn('dont do anything as `browser.tabs.opentabfor.middleclick` pref is set to false, so middleclick is not meant for new tabs')
		return;
	}

	var win = e.view; //Services.wm.getMostRecentWindow('navigator:browser');
	if (!win) {
		console.error('no win found, this is real weird and should never happen');
		throw new Error('no win found, this is real weird and should never happen');
	}
	var shiftNotDown_focusNewTab = Services.prefs.getBoolPref('browser.tabs.loadInBackground');
	var shiftDown_focusNewTab = !shiftNotDown_focusNewTab;

	//var engineName = e.target.label;
	//console.log('enigneName:', engineName)
	var engine = e.target.engine; //Services.search.getEngineByName(engineName)
	if (!engine) {
		throw new Error('could not get engine from e.target "' + e.target + '"');
	}
	var submission = engine.getSubmission(win.BrowserSearch.searchBar.value, null, 'searchbar');
	var useNewTab = true; //always true as is mid click and openTabForMidClick == true
	if (e.shiftKey) {
		win.openLinkIn(submission.uri.spec,
			useNewTab ? 'tab' : 'current', {
				postData: submission.postData,
				inBackground: shiftDown_focusNewTab,
				relatedToCurrent: true
			});
			
			//if inBackground then dont hide pop
			if (!shiftDown_focusNewTab) {
				popup.hidePopup();
			}
	} else {
		win.openLinkIn(submission.uri.spec,
			useNewTab ? 'tab' : 'current', {
				postData: submission.postData,
				inBackground: shiftNotDown_focusNewTab,
				relatedToCurrent: true
			});
			
			//if inBackground then dont hide pop
			if (!shiftNotDown_focusNewTab) {
				popup.hidePopup();
			}
	}
}

/*start - windowlistener*/
var windowListener = {
	//DO NOT EDIT HERE
	onOpenWindow: function (aXULWindow) {
		// Wait for the window to finish loading
		let aDOMWindow = aXULWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
		aDOMWindow.addEventListener('load', function () {
			aDOMWindow.removeEventListener('load', arguments.callee, false);
			windowListener.loadIntoWindow(aDOMWindow);
		}, false);
	},
	onCloseWindow: function (aXULWindow) {},
	onWindowTitleChange: function (aXULWindow, aNewTitle) {},
	register: function () {
		
		// Load into any existing windows
		let DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			let aDOMWindow = DOMWindows.getNext();
			windowListener.loadIntoWindow(aDOMWindow);
		}
		// Listen to new windows
		Services.wm.addListener(windowListener);
	},
	unregister: function () {
		// Unload from any existing windows
		let DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			let aDOMWindow = DOMWindows.getNext();
			windowListener.unloadFromWindow(aDOMWindow);
		}
		
		//Stop listening so future added windows dont get this attached
		Services.wm.removeListener(windowListener);
	},
	//END - DO NOT EDIT HERE
	loadIntoWindow: function (aDOMWindow) {
		if (!aDOMWindow) {
			return;
		}
		
		if (aDOMWindow.BrowserSearch) {
			aDOMWindow.BrowserSearch.searchBar._popup.addEventListener('click', midClickd, false);
		}
	},
	unloadFromWindow: function (aDOMWindow) {
		if (!aDOMWindow) {
			return;
		}
		
		if (aDOMWindow.BrowserSearch) {
			aDOMWindow.BrowserSearch.searchBar._popup.removeEventListener('click', midClickd, false);
		}
	}
};
/*end - windowlistener*/

function install() {}

function uninstall() {}

function startup() {
	windowListener.register();
	
	for (var o in observers) {
		observers[o].reg();
	}
}
 
function shutdown(aData, aReason) {
	if (aReason == APP_SHUTDOWN) return;

	windowListener.unregister();
	
	for (var o in observers) {
		observers[o].unreg();
	}
}
