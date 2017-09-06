var MyVars = {
    keepTrying: true
};

$(document).ready(function () {
    //debugger;

    $("#createBucket").click(function (evt) {
        // adamnagy_2017_06_14
        var bucketName = $("#bucketName").val()
        var bucketType = $("#bucketType").val()
        $.ajax ({
            url: '/dm/buckets',
            type: 'POST',
            contentType: 'application/json',
            dataType: 'json',
            data: JSON.stringify({
                bucketName: bucketName,
                bucketType: bucketType
            })
        }).done (function (data) {
            console.log('Response' + data);
            showProgress("Bucket created", "success")
            $('#forgeFiles').jstree(true).refresh()
        }).fail (function (xhr, ajaxOptions, thrownError) {
            console.log('Bucket creation failed!')
            showProgress("Could not create bucket", "failed")
        }) ;
    });

    $("#forgeUploadHidden").change(function(evt) {

        showProgress("Uploading file... ", "inprogress");
        var data = new FormData () ;
        var fileName = this.value;
        var that = this

        data.append (0, this.files[0]) ;
        $.ajax ({
            url: '/dm/files',
            type: 'POST',
            headers: { 'x-file-name': fileName, 'id': MyVars.selectedNode.id },
            data: data,
            cache: false,
            processData: false, // Don't process the files
            contentType: false, // Set content type to false as jQuery will tell the server its a query string request
            complete: null
        }).done (function (data) {
            console.log('Uploaded file "' + data.fileName + '" with urn = ' + data.objectId);

            showProgress("File uploaded", "success");
            $('#forgeFiles').jstree(true).refresh()

            // Clear selected files list
            that.value = ""
        }).fail (function (xhr, ajaxOptions, thrownError) {
            console.log(fileName + ' upload failed!') ;
            showProgress("Upload failed", "failed");
        }) ;
    });

    var upload = $("#uploadFile").click(function(evt) {
        evt.preventDefault();
        $("#forgeUploadHidden").trigger("click");
    });

    var auth = $("#authenticate")
    auth.click(function () {
        // Get the tokens
        get2LegToken(function(token) {
            var auth = $("#authenticate");

            MyVars.token2Leg = token;

            auth.html('You\'re logged in');

            // Fill the tree with A360 items
            prepareFilesTree();

            // Download list of available file formats
            fillFormats();
        });
    });

    $('#progressInfo').click(function() {
        MyVars.keepTrying = false;
        showProgress("Translation stopped", 'failed');
    });
});

function base64encode(str) {
    var ret = "";
    if (window.btoa) {
        ret = window.btoa(str);
    } else {
        // IE9 support
        ret = window.Base64.encode(str);
    }

    // Remove ending '=' signs
    // Use _ instead of /
    // Use - insteaqd of +
    // Have a look at this page for info on "Unpadded 'base64url' for "named information" URI's (RFC 6920)"
    // which is the format being used by the Model Derivative API
    // https://en.wikipedia.org/wiki/Base64#Variants_summary_table
    var ret2 = ret.replace(/=/g, '').replace(/[/]/g, '_').replace(/[+]/g, '-');

    console.log('base64encode result = ' + ret2);

    return ret2;
}

function logoff() {
    $.ajax({
        url: '/user/logoff',
        success: function (oauthUrl) {
            location.href = oauthUrl;
        }
    });
}

function get2LegToken(callback) {

    if (callback) {
        var client_id = $('#client_id').val();
        var client_secret = $('#client_secret').val();
        var scopes = $('#scopes').val();
        $.ajax({
            url: '/user/token',
            data: {
                client_id: client_id,
                client_secret: client_secret,
                scopes: scopes
            },
            success: function (data) {
                MyVars.token2Leg = data.token;
                console.log('Returning new 3 legged token (User Authorization): ' + MyVars.token2Leg);
                callback(data.token, data.expires_in);
                showProgress()
            },
            error: function(err, text) {
                showProgress(err.responseText, 'failed');
            }
        });
    } else {
        console.log('Returning saved 3 legged token (User Authorization): ' + MyVars.token2Leg);

        return MyVars.token2Leg;
    }
}

// http://stackoverflow.com/questions/4068373/center-a-popup-window-on-screen
function PopupCenter(url, title, w, h) {
    // Fixes dual-screen position                         Most browsers      Firefox
    var dualScreenLeft = window.screenLeft != undefined ? window.screenLeft : screen.left;
    var dualScreenTop = window.screenTop != undefined ? window.screenTop : screen.top;

    var width = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth ? document.documentElement.clientWidth : screen.width;
    var height = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height;

    var left = ((width / 2) - (w / 2)) + dualScreenLeft;
    var top = ((height / 2) - (h / 2)) + dualScreenTop;
    var newWindow = window.open(url, title, 'scrollbars=yes, width=' + w + ', height=' + h + ', top=' + top + ', left=' + left);

    // Puts focus on the newWindow
    if (window.focus) {
        newWindow.focus();
    }
}

function downloadDerivative(urn, derUrn, fileName) {
    console.log("downloadDerivative for urn=" + urn + " and derUrn=" + derUrn);
    // fileName = file name you want to use for download
    var url = window.location.protocol + "//" + window.location.host +
        "/md/download?urn=" + urn +
        "&derUrn=" + derUrn +
        "&fileName=" + encodeURIComponent(fileName);

    window.open(url,'_blank');
}

function getThumbnail(urn) {
    console.log("downloadDerivative for urn=" + urn);
    // fileName = file name you want to use for download
    var url = window.location.protocol + "//" + window.location.host +
        "/dm/thumbnail?urn=" + urn;

    window.open(url,'_blank');
}

function isArraySame(arr1, arr2) {
    // If both are undefined or has no value
    if (!arr1 && !arr2)
        return true;

    // If just one of them has no value
    if (!arr1 || !arr2)
        return false;

    return (arr1.sort().join(',') === arr2.sort().join(','));
}

function getDerivativeUrns(derivative, format, getThumbnail, objectIds) {
    console.log(
        "getDerivativeUrns for derivative=" + derivative.outputType +
        " and objectIds=" + (objectIds ? objectIds.toString() : "none"));
    var res = [];
    for (var childId in derivative.children) {
        var child = derivative.children[childId];
        // using toLowerCase to handle inconsistency
        if (child.role === '3d' || child.role.toLowerCase() === format) {
            if (isArraySame(child.objectIds, objectIds)) {
                // Some formats like svf might have children
                if (child.children) {
                    for (var subChildId in child.children) {
                        var subChild = child.children[subChildId];

                        if (subChild.role === 'graphics') {
                            res.push(subChild.urn);
                            if (!getThumbnail)
                                return res;
                        } else if (getThumbnail && subChild.role === 'thumbnail') {
                            res.push(subChild.urn);
                            return res;
                        }
                    }
                } else {
                    res.push(child.urn);
                    return res;
                }
            }
        }
    }

    return null;
}

// OBJ: guid & objectIds are also needed
// SVF, STEP, STL, IGES:
// Posts the job then waits for the manifest and then download the file
// if it's created
function askForFileType(format, urn, guid, objectIds, rootFileName, fileExtType, onsuccess) {
    console.log("askForFileType " + format + " for urn=" + urn);
    var advancedOptions = {
        'stl' : {
            "format": "binary",
            "exportColor": true,
            "exportFileStructure": "single" // "multiple" does not work
        },
        'obj' : {
            "modelGuid": guid,
            "objectIds": objectIds
        }
    };

    $.ajax({
        url: '/md/export',
        type: 'POST',
        contentType: 'application/json',
        dataType: 'json',
        data: JSON.stringify(
            {
                urn: urn,
                format: format,
                advanced: advancedOptions[format],
                rootFileName: rootFileName,
                fileExtType: fileExtType
            }
        )
    }).done(function (data) {
        console.log(data);

        if (data.result === 'success' // newly submitted data
            || data.result === 'created') { // already submitted data
            getManifest(urn, function (res) {
                onsuccess(res);
            });
        }
    }).fail(function(err) {
        showProgress(err.responseText, "failed");
        console.log('/md/export call failed\n' + err.statusText);
    });
}

// We need this in order to get an OBJ file for the model
function getMetadata(urn, onsuccess) {
    console.log("getMetadata for urn=" + urn);
    $.ajax({
        url: '/md/metadatas/' + urn,
        type: 'GET'
    }).done(function (data) {
        console.log(data);

        // Get first model guid
        // If it does not exists then something is wrong
        // let's check the manifest
        // If get manifest sees a failed attempt then it will
        // delete the manifest
        var md0 = data.data.metadata[0];
        if (!md0) {
            getManifest(urn, function () {});
        } else {
            var guid = md0.guid;
            if (onsuccess !== undefined) {
                onsuccess(guid);
            }
        }
    }).fail(function(err) {
        console.log('GET /md/metadata call failed\n' + err.statusText);
    });
}

function getHierarchy(urn, guid, onsuccess) {
    console.log("getHierarchy for urn=" + urn + " and guid=" + guid);
    $.ajax({
        url: '/md/hierarchy',
        type: 'GET',
        data: {urn: urn, guid: guid}
    }).done(function (data) {
        console.log(data);

        // If it's 'accepted' then it's not ready yet
        if (data.result === 'accepted') {
            // Let's try again
            if (MyVars.keepTrying) {
                window.setTimeout(function() {
                        getHierarchy(urn, guid, onsuccess);
                    }, 500
                );
            } else {
                MyVars.keepTrying = true;
            }

            return;
        }

        // We got what we want
        if (onsuccess !== undefined) {
            onsuccess(data);
        }
    }).fail(function(err) {
        console.log('GET /md/hierarchy call failed\n' + err.statusText);
    });
}

function getProperties(urn, guid, onsuccess) {
    console.log("getProperties for urn=" + urn + " and guid=" + guid);
    $.ajax({
        url: '/md/properties',
        type: 'GET',
        data: {urn: urn, guid: guid}
    }).done(function (data) {
        console.log(data);

        if (onsuccess !== undefined) {
            onsuccess(data);
        }
    }).fail(function(err) {
        console.log('GET /api/properties call failed\n' + err.statusText);
    });
}

function getManifest(urn, onsuccess) {
    console.log("getManifest for urn=" + urn);
    $.ajax({
        url: '/md/manifests/' + urn,
        type: 'GET'
    }).done(function (data) {
        console.log(data);

        if (data.status !== 'failed') {
            if (data.progress !== 'complete') {
                showProgress("Translation progress: " + data.progress, data.status);

                if (MyVars.keepTrying) {
                    // Keep calling until it's done
                    window.setTimeout(function() {
                            getManifest(urn, onsuccess);
                        }, 500
                    );
                } else {
                    MyVars.keepTrying = true;
                }
            } else {
                showProgress("Translation completed", data.status);
                onsuccess(data);
            }
        // if it's a failed translation best thing is to delete it
        } else {
            showProgress("Translation failed", data.status);
            // Should we do automatic manifest deletion in case of a failed one?
            //delManifest(urn, function () {});
        }
    }).fail(function(err) {
        showProgress("Translation failed", 'failed');
        console.log('GET /api/manifest call failed\n' + err.statusText);
    });
}

function delManifest(urn, onsuccess) {
    console.log("delManifest for urn=" + urn);
    $.ajax({
        url: '/md/manifests/' + urn,
        type: 'DELETE'
    }).done(function (data) {
        console.log(data);
        if (data.status === 'success') {
            if (onsuccess !== undefined) {
                onsuccess(data);
                showProgress("Manifest deleted", "success")
            }
        }
    }).fail(function(err) {
        console.log('DELETE /api/manifest call failed\n' + err.statusText);
    });
}

/////////////////////////////////////////////////////////////////
// Formats / #forgeFormats
// Shows the export file formats available for the selected model
/////////////////////////////////////////////////////////////////

function getFormats(onsuccess) {
    console.log("getFormats");
    $.ajax({
        url: '/md/formats',
        type: 'GET'
    }).done(function (data) {
        console.log(data);

        if (onsuccess !== undefined) {
            onsuccess(data);
        }
    }).fail(function(err) {
        console.log('GET /md/formats call failed\n' + err.statusText);
    });
}

function fillFormats() {
    getFormats(function(data) {
        var forgeFormats = $("#forgeFormats");
        forgeFormats.data("forgeFormats", data);

        var download = $("#downloadExport");
        download.click(function() {
            MyVars.keepTrying = true;

            var elem = $("#forgeHierarchy");
            var tree = elem.jstree();
            var rootNodeId = tree.get_node('#').children[0];
            var rootNode = tree.get_node(rootNodeId);

            var format = $("#forgeFormats").val();
            var urn = MyVars.selectedUrn;
            var guid = MyVars.selectedGuid;
            var fileName = rootNode.text + "." + format;
            var rootFileName = MyVars.rootFileName;
            var nodeIds = elem.jstree("get_checked", null, true);

            // Only OBJ supports subcomponent selection
            // using objectId's
            var objectIds = null;
            if (format === 'obj') {
                objectIds = [-1];
                if (nodeIds.length) {
                    objectIds = [];

                    $.each(nodeIds, function (index, value) {
                        objectIds.push(parseInt(value, 10));
                    });
                }
            }

            // The rest can be exported with a single function
            askForFileType(format, urn, guid, objectIds, rootFileName, MyVars.fileExtType, function (res) {
                if (format === 'thumbnail') {
                    getThumbnail(urn);

                    return;
                }

                // Find the appropriate obj part
                for (var derId in res.derivatives) {
                    var der = res.derivatives[derId];
                    if (der.outputType === format) {
                        // found it, now get derivative urn
                        // leave objectIds parameter undefined
                        var derUrns = getDerivativeUrns(der, format, false, objectIds);

                        // url encode it
                        if (derUrns) {
                            derUrns[0] = encodeURIComponent(derUrns[0]);

                            downloadDerivative(urn, derUrns[0], fileName);

                            // in case of obj format, also try to download the material
                            if (format === 'obj') {
                                downloadDerivative(urn, derUrns[0].replace('.obj' , '.mtl'), fileName.replace('.obj', '.mtl'));
                            }
                        } else {
                            showProgress("Could not find specific OBJ file", "failed");
                            console.log("askForFileType, Did not find the OBJ translation with the correct list of objectIds");
                        }

                        return;
                    }
                }

                showProgress("Could not find exported file", "failed");
                console.log("askForFileType, Did not find " + format + " in the manifest");
            });

        });

        var deleteManifest = $("#deleteManifest");
        deleteManifest.click(function() {
            var urn = MyVars.selectedUrn;

            cleanupViewer();

            delManifest(urn, function() { });
        });
    });
}

function updateFormats(format) {

    var forgeFormats = $("#forgeFormats");
    var formats = forgeFormats.data("forgeFormats");
    forgeFormats.empty();

    // obj is not listed for all possible files
    // using this workaround for the time being
    //forgeFormats.append($("<option />").val('obj').text('obj'));

    $.each(formats.formats, function(key, value) {
        if (key === 'obj' || value.indexOf(format) > -1) {
            forgeFormats.append($("<option />").val(key).text(key));
        }
    });
}

/////////////////////////////////////////////////////////////////
// Files Tree / #forgeFiles
// Shows the A360 hubs, projects, folders and files of
// the logged in user
/////////////////////////////////////////////////////////////////

function getFileType(fileName) {
    var fileNameParts = fileName.split('.')
    return fileNameParts[fileNameParts.length - 1]
}

function prepareFilesTree() {
    console.log("prepareFilesTree");
    $('#forgeFiles').jstree({
        'core': {
            'themes': { "icons": true },
            'check_callback': true, // make it modifiable
            'data': {
                "url": '/dm/treeNode',
                "dataType": "json",
                "data": function (node) {
                    return {
                        "id": node.id
                    };
                }
            }
        },
        "ui": {
            "select_limit": 1
        },
        'types': {
            'default': {
                'icon': 'glyphicon glyphicon-cloud'
            },
            'bucket': {
                'icon': 'glyphicon glyphicon-folder-open'
            },
            'file': {
                'icon': 'glyphicon glyphicon-file'
            }
        },
        "plugins": ["types", "contextmenu"], // let's not use sort or state: , "state" and "sort"],
        'contextmenu': {
            'select_node': true,
            'items': filesTreeContextMenu
        }
    }).bind("select_node.jstree", function (evt, data) {
        // Clean up previous instance
        cleanupViewer();

        // Disable the hierarchy related controls for the time being
        $("#forgeFormats").attr('disabled', 'disabled');
        $("#downloadExport").attr('disabled', 'disabled');

        MyVars.selectedNode = data.node;

        if (data.node.type === 'file') {
            $("#deleteManifest").removeAttr('disabled');
            $("#uploadFile").removeAttr('disabled');

            MyVars.keepTrying = true;

            // Clear hierarchy tree
            $('#forgeHierarchy').empty().jstree('destroy');

            // Clear properties tree
            $('#forgeProperties').empty().jstree('destroy');

            // Delete cached data
            $('#forgeProperties').data('forgeProperties', null);

            MyVars.fileExtType = getFileType(data.node.text)

            MyVars.selectedUrn = base64encode(data.node.id);
            MyVars.rootFileName = data.node.text
            if (MyVars.fileExtType === 'zip') {
                MyVars.rootFileName = MyVars.rootFileName.slice(0, -4)
            }

            var realExtType = getFileType(MyVars.rootFileName)
            updateFormats(realExtType);

            // Fill hierarchy tree
            // urn, guid, objectIds, rootFileName, fileExtType
            showHierarchy(
                MyVars.selectedUrn,
                null,
                null,
                MyVars.rootFileName,
                MyVars.fileExtType
            );
            console.log(
                "MyVars.selectedUrn = " + MyVars.selectedUrn
            );
        } else {
            $("#deleteManifest").attr('disabled', 'disabled');
            $("#uploadFile").attr('disabled', 'disabled');

            // Just open the children of the node, so that it's easier
            // to find the actual versions
            $("#forgeFiles").jstree("open_node", data.node);

            // And clear trees to avoid confusion thinking that the
            // data belongs to the clicked model
            $('#forgeHierarchy').empty().jstree('destroy');
            $('#forgeProperties').empty().jstree('destroy');
        }
    });
}

function downloadFile(id) {
    console.log("Download file = " + id);
    // fileName = file name you want to use for download
    var url = window.location.protocol + "//" + window.location.host +
        "/dm/files/" + encodeURIComponent(id);

    window.open(url, '_blank');
}

function deleteFile(id) {

    console.log("Delete file = " + id);
    $.ajax({
        url: '/dm/files/' + encodeURIComponent(id),
        type: 'DELETE'
    }).done(function (data) {
        console.log(data);
        if (data.status === 'success') {
            $('#forgeFiles').jstree(true).refresh()
            showProgress("File deleted", "success")
        }
    }).fail(function(err) {
        console.log('DELETE /dm/files/ call failed\n' + err.statusText);
    });
}

function deleteBucket(id) {
    console.log("Delete bucket = " + id);
    $.ajax({
        url: '/dm/buckets/' + encodeURIComponent(id),
        type: 'DELETE'
    }).done(function (data) {
        console.log(data);
        if (data.status === 'success') {
            $('#forgeFiles').jstree(true).refresh()
            showProgress("Bucket deleted", "success")
        }
    }).fail(function(err) {
        console.log('DELETE /dm/buckets/ call failed\n' + err.statusText);
    });
}

function filesTreeContextMenu(node, callback) {
    MyVars.selectedNode = node
    if (node.type === 'bucket') {
        callback({
            bucketDelete: {
                "label": "Delete bucket",
                "action": function (obj) {
                    deleteBucket(MyVars.selectedNode.id)
                }
            },
            fileUpload: {
                "label": "Upload file",
                "action": function (obj) {
                    $("#forgeUploadHidden").trigger("click");
                }
            }
        })
    } else {
        callback({
            fileDelete: {
                "label": "Delete file",
                "action": function (obj) {
                    deleteFile(MyVars.selectedNode.id)
                }
            },
            fileDownload: {
                "label": "Download file",
                "action": function (obj) {
                    downloadFile(MyVars.selectedNode.id)
                }
            }
        })
    }

    return;
}

/////////////////////////////////////////////////////////////////
// Hierarchy Tree / #forgeHierarchy
// Shows the hierarchy of components in selected model
/////////////////////////////////////////////////////////////////

function showHierarchy(urn, guid, objectIds, rootFileName, fileExtType) {

    // You need to
    // 1) Post a job
    // 2) Get matadata (find the model guid you need)
    // 3) Get the hierarchy based on the urn and model guid

    // Get svf export in order to get hierarchy and properties
    // for the model
    var format = 'svf';
    askForFileType(format, urn, guid, objectIds, rootFileName, fileExtType, function (manifest) {
        getMetadata(urn, function (guid) {
            initializeViewer(urn);

            /*
            showProgress("Retrieving hierarchy...", "inprogress");

            getHierarchy(urn, guid, function (data) {
                showProgress("Retrieved hierarchy", "success");

                for (var derId in manifest.derivatives) {
                    var der = manifest.derivatives[derId];
                    // We just have to make sure there is an svf
                    // translation, but the viewer will find it
                    // from the urn
                    if (der.outputType === 'svf') {

                        initializeViewer(urn);
                    }
                }

                prepareHierarchyTree(urn, guid, data.data);
            });
            */
        });
    });
}

function addHierarchy(nodes) {
    for (var nodeId in nodes) {
        var node = nodes[nodeId];

        // We are also adding properties below that
        // this function might iterate over and we should skip
        // those nodes
        if (node.type && node.type === 'property' || node.type === 'properties') {
            // skip this node
            var str = "";
        } else {
            node.text = node.name;
            node.children = node.objects;
            if (node.objectid === undefined) {
                node.type = 'dunno'
            } else {
                node.id = node.objectid;
                node.type = 'object'
            }
            addHierarchy(node.objects);
        }
    }
}

function prepareHierarchyTree(urn, guid, json) {
    // Convert data to expected format
    addHierarchy(json.objects);

    // Enable the hierarchy related controls
    $("#forgeFormats").removeAttr('disabled');
    $("#downloadExport").removeAttr('disabled');

    // Store info of selected item
    MyVars.selectedUrn = urn;
    MyVars.selectedGuid = guid;

    // init the tree
    $('#forgeHierarchy').jstree({
        'core': {
            'check_callback': true,
            'themes': {"icons": true},
            'data': json.objects
        },
        'checkbox' : {
            'tie_selection': false,
            "three_state": true,
            'whole_node': false
        },
        'types': {
            'default': {
                'icon': 'glyphicon glyphicon-cloud'
            },
            'object': {
                'icon': 'glyphicon glyphicon-save-file'
            }
        },
        "plugins": ["types", "sort", "checkbox", "ui", "themes", "contextmenu"],
        'contextmenu': {
            'select_node': false,
            'items': hierarchyTreeContextMenu
        }
    }).bind("select_node.jstree", function (evt, data) {
        if (data.node.type === 'object') {
            var urn = MyVars.selectedUrn;
            var guid = MyVars.selectedGuid;
            var objectId = data.node.original.objectid;

            // Empty the property tree
            $('#forgeProperties').empty().jstree('destroy');

            fetchProperties(urn, guid, function (props) {
                preparePropertyTree(urn, guid, objectId, props);
                selectInViewer([objectId]);
            });
        }
    }).bind("check_node.jstree uncheck_node.jstree", function (evt, data) {
        // To avoid recursion we are checking if the changes are
        // caused by a viewer selection which is calling
        // selectInHierarchyTree()
        if (!MyVars.selectingInHierarchyTree) {
            var elem = $('#forgeHierarchy');
            var nodeIds = elem.jstree("get_checked", null, true);

            // Convert from strings to numbers
            var objectIds = [];
            $.each(nodeIds, function (index, value) {
                objectIds.push(parseInt(value, 10));
            });

            selectInViewer(objectIds);
        }
    });
}

function selectInHierarchyTree(objectIds) {
    MyVars.selectingInHierarchyTree = true;

    var tree = $("#forgeHierarchy").jstree();

    // First remove all the selection
    tree.uncheck_all();

    // Now select the newly selected items
    for (var key in objectIds) {
        var id = objectIds[key];

        // Select the node
        tree.check_node(id);

        // Make sure that it is visible for the user
        tree._open_to(id);
    }

    MyVars.selectingInHierarchyTree = false;
}

function hierarchyTreeContextMenu(node, callback) {
    var menuItems = {};

    var menuItem = {
        "label": "Select in Fusion",
        "action": function (obj) {
            var path = $("#forgeHierarchy").jstree().get_path(node,'/');
            console.log(path);

            // Open this in the browser:
            // fusion360://command=open&file=something&properties=MyCustomPropertyValues
            var url = "fusion360://command=open&file=something&properties=" + encodeURIComponent(path);
            $("#fusionLoader").attr("src", url);
        }
    };
    menuItems[0] = menuItem;

    //callback(menuItems);

    //return menuItems;
    return null; // for the time being
}

/////////////////////////////////////////////////////////////////
// Property Tree / #forgeProperties
// Shows the properties of the selected sub-component
/////////////////////////////////////////////////////////////////

// Storing the collected properties since you get them for the whole
// model. So when clicking on the various sub-components in the
// hierarchy tree we can reuse it instead of sending out another
// http request
function fetchProperties(urn, guid, onsuccess) {
    var props = $("#forgeProperties").data("forgeProperties");
    if (!props) {
        getProperties(urn, guid, function(data) {
            $("#forgeProperties").data("forgeProperties", data.data);
            onsuccess(data.data);
        })
    } else {
        onsuccess(props);
    }
}

// Recursively add all the additional properties under each
// property node
function addSubProperties(node, props) {
    node.children = node.children || [];
    for (var subPropId in props) {
        var subProp = props[subPropId];
        if (subProp instanceof Object) {
            var length = node.children.push({
                "text": subPropId,
                "type": "properties"
            });
            var newNode = node.children[length-1];
            addSubProperties(newNode, subProp);
        } else {
            node.children.push({
                "text": subPropId + " = " + subProp.toString(),
                "type": "property"
            });
        }
    }
}

// Add all the properties of the selected sub-component
function addProperties(node, props) {
    // Find the relevant property section
    for (var propId in props) {
        var prop = props[propId];
        if (prop.objectid === node.objectid) {
            addSubProperties(node, prop.properties);
        }
    }
}

function preparePropertyTree(urn, guid, objectId, props) {
    // Convert data to expected format
    var data = { 'objectid' : objectId };
    addProperties(data, props.collection);

    // init the tree
    $('#forgeProperties').jstree({
        'core': {
            'check_callback': true,
            'themes': {"icons": true},
            'data': data.children
        },
        'types': {
            'default': {
                'icon': 'glyphicon glyphicon-cloud'
            },
            'property': {
                'icon': 'glyphicon glyphicon-tag'
            },
            'properties': {
                'icon': 'glyphicon glyphicon-folder-open'
            }
        },
        "plugins": ["types", "sort"]
    }).bind("activate_node.jstree", function (evt, data) {
       //
    });
}

/////////////////////////////////////////////////////////////////
// Viewer
// Based on Autodesk Viewer basic sample
// https://developer.autodesk.com/api/viewerapi/
/////////////////////////////////////////////////////////////////

function cleanupViewer() {
    // Clean up previous instance
    if (MyVars.viewer && MyVars.viewer.model) {
        console.log("Unloading current model from Autodesk Viewer");

        MyVars.viewer.impl.unloadModel(MyVars.viewer.model);
        MyVars.viewer.impl.sceneUpdated(true);
    }
}

function initializeViewer(urn) {
    cleanupViewer();

    console.log("Launching Autodesk Viewer for: " + urn);

    var options = {
        document: 'urn:' + urn,
        env: 'AutodeskProduction',
        getAccessToken: get2LegToken // this works fine, but if I pass get2LegToken it only works the first time
    };

    if (MyVars.viewer) {
        loadDocument(MyVars.viewer, options.document);
    } else {
        var viewerElement = document.getElementById('forgeViewer');
        var config = {
            //extensions: ['Autodesk.Viewing.webVR', 'Autodesk.Viewing.MarkupsGui'],
            //experimental: ['webVR_orbitModel']
        };
        MyVars.viewer = new Autodesk.Viewing.Private.GuiViewer3D(viewerElement, config);
        Autodesk.Viewing.Initializer(
            options,
            function () {
                MyVars.viewer.start(); // this would be needed if we also want to load extensions
                loadDocument(MyVars.viewer, options.document);
                addSelectionListener(MyVars.viewer);
            }
        );
    }
}

function addSelectionListener(viewer) {
    viewer.addEventListener(
        Autodesk.Viewing.SELECTION_CHANGED_EVENT,
        function (event) {
            selectInHierarchyTree(event.dbIdArray);

            var dbId = event.dbIdArray[0];
            if (dbId) {
                viewer.getProperties(dbId, function (props) {
                   console.log(props.externalId);
                });
            }
        });
}

function loadDocument(viewer, documentId) {
    // Set the Environment to "Riverbank"
    viewer.setLightPreset(8);

    // Make sure that the loaded document's setting won't
    // override it and change it to something else
    viewer.prefs.tag('ignore-producer');

    Autodesk.Viewing.Document.load(
        documentId,
        // onLoad
        function (doc) {
            var geometryItems = [];
            // Try 3d geometry first
            geometryItems = Autodesk.Viewing.Document.getSubItemsWithProperties(doc.getRootItem(), {
                'type': 'geometry',
                'role': '3d'
            }, true);

            // If no 3d then try 2d
            if (geometryItems.length < 1)
                geometryItems = Autodesk.Viewing.Document.getSubItemsWithProperties(doc.getRootItem(), {
                    'type': 'geometry',
                    'role': '2d'
                }, true);

            if (geometryItems.length > 0) {
                var path = doc.getViewablePath(geometryItems[0]);
                //viewer.load(doc.getViewablePath(geometryItems[0]), null, null, null, doc.acmSessionId /*session for DM*/);
                var options = {};
                viewer.loadModel(path, options);
            }
        },
        // onError
        function (errorMsg) {
            //showThumbnail(documentId.substr(4, documentId.length - 1));
        }
    )
}

function selectInViewer(objectIds) {
    if (MyVars.viewer) {
        MyVars.viewer.select(objectIds);
    }
}

/////////////////////////////////////////////////////////////////
// Other functions
/////////////////////////////////////////////////////////////////

function showProgress(text, status) {
    var progressInfo = $('#progressInfo');
    var progressInfoText = $('#progressInfoText');
    var progressInfoIcon = $('#progressInfoIcon');

    var oldClasses = progressInfo.attr('class');
    var newClasses = "";
    var newText = text;

    if (status === 'failed') {
        newClasses = 'btn btn-danger';
    } else if (status === 'inprogress' || status === 'pending') {
        newClasses = 'btn btn-warning';
        newText += " (Click to stop)";
    } else if (status === 'success') {
        newClasses = 'btn btn-success';
    } else {
        newClasses = 'btn btn-info';
        newText = "Progress info"
    }

    // Only update if changed
    if (progressInfoText.text() !== newText) {
        progressInfoText.text(newText);
    }

    if (oldClasses !== newClasses) {
        progressInfo.attr('class', newClasses);

        if (newClasses === 'btn btn-warning') {
            progressInfoIcon.attr('class', 'glyphicon glyphicon-refresh glyphicon-spin');
        } else {
            progressInfoIcon.attr('class', '');
        }
    }
}

