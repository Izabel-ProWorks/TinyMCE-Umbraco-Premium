﻿angular.module("umbraco").controller("TinyMCE.Umbraco.Premium.PrevalueEditors.RteController",
    function ($scope, $sce, tinyMceService, stylesheetResource, assetsService, editorService) {
        var cfg = tinyMceService.defaultPrevalues();

        $scope.model.createdPlugins = false;

        if ($scope.model.value) {
            if (Utilities.isString($scope.model.value)) {
                $scope.model.value = cfg;
            }
        } else {
            $scope.model.value = cfg;
        }

        if (!$scope.model.value.stylesheets) {
            $scope.model.value.stylesheets = [];
        }
        if (!$scope.model.value.customConfig) {
            $scope.model.value.customConfig = {};
        }
        if (!$scope.model.value.toolbar) {
            $scope.model.value.toolbar = [];
        }
        if (!$scope.model.value.pluginsToExclude) {
            $scope.model.value.pluginsToExclude = [];
        }
        if (!$scope.model.value.plugins) {
            $scope.model.createdPlugins = true;
            $scope.model.value.plugins = [];
        }
        if (!$scope.model.value.maxImageSize && $scope.model.value.maxImageSize != 0) {
            $scope.model.value.maxImageSize = cfg.maxImageSize;
        }
        if (!$scope.model.value.mode) {
            $scope.model.value.mode = "classic";
        }
        else if ($scope.model.value.mode === 'distraction-free') {
            // Due to legacy reasons, the older 'distraction-free' mode is kept and remapped to 'inline'
            $scope.model.value.mode = 'inline';
        }       

        tinyMceService.configuration().then(config => {
            $scope.tinyMceConfig = config;

            // If empty, then add all plugins so they get selected below if we created the array above (don't add all if they simply selected none)
            if ($scope.model.createdPlugins) {
                if ($scope.model.value.plugins != null && $scope.model.value.plugins.length == 0) {
                    $scope.model.value.plugins = _.map($scope.tinyMceConfig.plugins, obj => {
                        return obj.name;
                    });
                }
            }

            var tinymcePremiumPluginsList = window.tinymcepremium.Config.tinymcePremiumPluginsList;

            // Remove extra plugins that maybe no longer apply but were saved to prevalues at some point
            var allPossiblePlugins = _.pluck($scope.tinyMceConfig.plugins, "name");
            var premiumPlugins = _.pluck(tinymcePremiumPluginsList, "alias");
            allPossiblePlugins = _.union(allPossiblePlugins, premiumPlugins);
            $scope.model.value.plugins = _.intersection(allPossiblePlugins, $scope.model.value.plugins);
            $scope.model.value.pluginsToExclude = _.difference(allPossiblePlugins, $scope.model.value.plugins);

            // Setup the checklist data for selecting plugins
            if (tinymcePremiumPluginsList != null) {
                $scope.tinyMceConfig.pluginOptions = _.map(tinymcePremiumPluginsList, obj => {

                    const objPlugin = Utilities.extend(obj, {
                        displayName: obj.name,
                        selected: $scope.model.value.plugins.indexOf(obj.alias) >= 0,
                    });

                    return objPlugin;
                });
            }

            var allCommands = $scope.tinyMceConfig.commands;
            _.each(tinymcePremiumPluginsList, function (p) {
                if (p.command != null) {
                    var relatedCommand = _.findWhere(allCommands, { alias: p.command.alias });
                    if (!relatedCommand) {
                        allCommands = _.union(allCommands, [p.command]);
                    }
                }
            });

            // extend commands with properties for font-icon and if it is a custom command
            $scope.tinyMceConfig.commands = _.map(allCommands, obj => {
                const icon = getIcon(obj.alias);

                const objCmd = Utilities.extend(obj, {
                    fontIcon: icon.name,
                    isCustom: icon.isCustom,
                    selected: $scope.model.value.toolbar.indexOf(obj.alias) >= 0,
                    disabled: $scope.model.value.pluginsToExclude.indexOf(obj.alias) >= 0,
                    icon: "mce-ico " + (icon.isCustom ? ' mce-i-custom ' : ' mce-i-') + icon.name
                });

                return objCmd;
            });

            assetsService.loadJs("lib/tinymce/icons/default/icons.js", $scope).then(() => {
                const icons = tinymce.IconManager.get('default').icons;
                const parser = new DOMParser();

                Utilities.forEach($scope.tinyMceConfig.commands, cmd => {
                    let icon = getTinyIcon(cmd.alias);

                    if (!cmd.isCustom && icons.hasOwnProperty(icon)) {
                        const svg = icons[icon];
                        const frag = parser.parseFromString(svg, 'text/html').body.childNodes[0];
                        const width = frag.getAttribute("width");
                        const height = frag.getAttribute("height");

                        frag.setAttribute("viewBox", `0 0 ${width} ${height}`);
                        cmd.svgIcon = $sce.trustAsHtml(frag.outerHTML);
                        cmd.icon = null;
                    }
                });
            });

        });

        stylesheetResource.getAll().then(stylesheets => {
            $scope.stylesheets = stylesheets;

            // if the CSS directory changes, previously assigned stylesheets are retained, but will not be visible
            // and will throw a 404 when loading the RTE. Remove them here. Still needs to be saved...
            let cssPath = Umbraco.Sys.ServerVariables.umbracoSettings.cssPath;
            $scope.model.value.stylesheets = $scope.model.value.stylesheets
                .filter(sheet => sheet.startsWith(cssPath));

            $scope.stylesheets.forEach(stylesheet => {
                // support both current format (full stylesheet path) and legacy format (stylesheet name only)
                stylesheet.selected = $scope.model.value.stylesheets.indexOf(stylesheet.path) >= 0 || $scope.model.value.stylesheets.indexOf(stylesheet.name) >= 0;
            });
        });

        $scope.selectPlugin = function (plugin) {
            var index = $scope.model.value.plugins.indexOf(plugin.alias);
            var indexInExcluded = $scope.model.value.pluginsToExclude.indexOf(plugin.alias);
            var relatedCommand = _.find($scope.tinyMceConfig.commands, function (c) {
                if (plugin.command != null) {
                    return c.alias === plugin.command.alias;
                }
                else {
                    return false;
                }
            });

            if (plugin.selected && index === -1) {
                $scope.model.value.plugins.push(plugin.alias);
                $scope.model.value.pluginsToExclude.splice(indexInExcluded, 1);
                if (relatedCommand) {
                    relatedCommand.disabled = false;
                    $scope.selectCommand(relatedCommand);
                }
            } else if (index >= 0) {
                $scope.model.value.pluginsToExclude.push(plugin.alias);
                $scope.model.value.plugins.splice(index, 1);
                if (relatedCommand) {
                    relatedCommand.disabled = true;
                    $scope.selectCommand(relatedCommand);
                }
            }
        };

        // Open dialog to edit the custom configuration
        var editConfigCollection = function (configValues, title, callback) {

            var editConfigCollectionOverlay = {
                config: configValues,
                title: title,
                view: "/App_Plugins/TinyMCE.Umbraco.Premium/Dialogs/editconfig.html",
                size: "medium",
                submit: function (model) {
                    callback(model.config);
                    editorService.close();
                },
                close: function (model) {
                    editorService.close();
                }
            };

            editorService.open(editConfigCollectionOverlay);
        };

        // Method that the html can call to open the dialog to edit the custom configuration
        $scope.editConfig = function editConfig() {
            editConfigCollection($scope.model.value.customConfig, "Edit Custom TinyMCE Configuration", function (data) {
                $scope.model.value.customConfig = data;
            });
        }

        //$scope.clearCustomConfig = function () {
        //    $scope.model.value.customConfig = {};
        //};

        $scope.selectCommand = function (command) {
            var index = $scope.model.value.toolbar.indexOf(command.alias);

            if (command.selected && index === -1) {
                $scope.model.value.toolbar.push(command.alias);
            } else if (index >= 0) {
                $scope.model.value.toolbar.splice(index, 1);
            }
        };

        $scope.selectStylesheet = css => {

            // find out if the stylesheet is already selected; first look for the full stylesheet path (current format)
            var index = $scope.model.value.stylesheets.indexOf(css.path);
            if (index === -1) {
                // ... then look for the stylesheet name (legacy format)
                index = $scope.model.value.stylesheets.indexOf(css.name);
            }

            if (index === -1) {
                $scope.model.value.stylesheets.push(css.path);
            } else {
                $scope.model.value.stylesheets.splice(index, 1);
            }
        };

        // Map command alias to icon name.
        function getTinyIcon(alias) {
            let icon = alias;

            switch (alias) {
                case "ace":
                case "code":
                    icon = "sourcecode";
                    break;
                case "anchor":
                    icon = "bookmark";
                    break;
                case "alignleft":
                    icon = "align-left";
                    break;
                case "aligncenter":
                    icon = "align-center";
                    break;
                case "alignright":
                    icon = "align-right";
                    break;
                case "alignjustify":
                    icon = "align-justify";
                    break;
                case "charmap":
                    icon = "insert-character";
                    break;
                case "hr":
                    icon = "horizontal-rule";
                    break;
                case "bullist":
                    icon = "unordered-list";
                    break;
                case "numlist":
                    icon = "ordered-list";
                    break;
                case "strikethrough":
                    icon = "strike-through";
                    break;
                case "removeformat":
                    icon = "remove-formatting";
                    break;
                case "blockquote":
                    icon = "quote";
                    break;
                case "forecolor":
                    icon = "text-color";
                    break;
                case "hilitecolor":
                    icon = "highlight-bg-color";
                    break;
                case "wordcount":
                    icon = "character-count";
                    break;
                case "emoticons":
                    icon = "emoji";
                    break;
                case "codesample":
                    icon = "code-sample";
                    break;
            }

            return icon;
        }

        // Map properties for specific commands
        function getIcon(alias) {
            var icon = { name: alias, isCustom: false };

            switch (alias) {
                case "ace":
                    icon.name = "code";
                    icon.isCustom = false;
                    break;
                case "styleselect":
                case "styles":
                case "fontsizeselect":
                    icon.name = "icon-list";
                    icon.isCustom = true;
                    break;
                case "umbembeddialog":
                    icon.name = "icon-tv";
                    icon.isCustom = true;
                    break;
                case "umbmediapicker":
                    icon.name = "icon-picture";
                    icon.isCustom = true;
                    break;
                case "umbblockpicker":
                    icon.name = "icon-document";
                    icon.isCustom = true;
                    break;
                case "umbmacro":
                    icon.name = "icon-settings-alt";
                    icon.isCustom = true;
                    break;
                default:
                    icon.name = alias;
                    icon.isCustom = false;
            }

            return icon;
        }
        

        var unsubscribe = $scope.$on("formSubmitting", function () {

            var commands = _.where($scope.tinyMceConfig.commands, { selected: true });
            $scope.model.value.toolbar = _.pluck(commands, "alias");

        });

        // when the scope is destroyed we need to unsubscribe
        $scope.$on('$destroy', function () {
            unsubscribe();
        });

        // load TinyMCE skin which contains css for font-icons
        assetsService.loadCss("lib/tinymce/skins/lightgray/skin.min.css", $scope);
    });
