/*
 * Paper.js - The Swiss Army Knife of Vector Graphics Scripting.
 * http://paperjs.org/
 *
 * Copyright (c) 2011 - 2014, Juerg Lehni & Jonathan Puckey
 * http://scratchdisk.com/ & http://jonathanpuckey.com/
 *
 * Distributed under the MIT license. See LICENSE file for details.
 *
 * All rights reserved.
 */

// Register a jsDump parser for Base.
QUnit.jsDump.setParser('Base', function (obj, stack) {
    // Just compare the string representation of classes inheriting from Base,
    // since they hide the internal values.
    return obj.toString();
});

// Override the default object parser to handle Base objects.
// We need to keep a reference to the previous implementation.
var objectParser = QUnit.jsDump.parsers.object;

QUnit.jsDump.setParser('object', function (obj, stack) {
    return (obj instanceof Base
            ? QUnit.jsDump.parsers.Base
            : objectParser).call(this, obj, stack);
});

var comparators = {
    Number: function(actual, expected, message, options) {
        // Compare with a default tolerance of Numerical.TOLERANCE:
        var ok = Math.abs(actual - expected)
                <= Base.pick(options && options.tolerance, Numerical.TOLERANCE);
        QUnit.push(ok, ok ? expected : actual, expected, message);
    },

    Array: function(actual, expected, message, options) {
        equals(actual.length, expected.length, (message || '') + ' length',
                options);
        for (var i = 0, l = actual.length; i < l; i++) {
            equals(actual[i], expected[i], (message || '') + ' [' + i + ']',
                options);
        }
    }
};

function getClass(object) {
    return typeof object === 'number' && 'Number'
        || Array.isArray(object) && 'Array'
        || object && object._class;
}

function getFunctionMessage(func) {
    var message = func.toString().match(
        /^\s*function[^\{]*\{([\s\S]*)\}\s*$/)[1]
            .replace(/    /g, '')
            .replace(/^\s+|\s+$/g, '');
    if (/^return /.test(message)) {
        message = message
            .replace(/^return /, '')
            .replace(/;$/, '');
    }
    return message;
}

// Override equals to convert functions to message and execute them as tests()
function equals(actual, expected, message, options) {
    // Allow the use of functions for actual, which will get called and their
    // source content extracted for readable reports.
    if (typeof actual === 'function') {
        if (!message)
            message = getFunctionMessage(actual);
        actual = actual();
    }
    if (actual != null) {
        var comparator = comparators[getClass(actual)];
        if (comparator)
            return comparator(actual, expected, message, options);
        // Support calling of #equals() on the actual or expected value.
        if (actual.equals)
            return QUnit.push(actual.equals(expected),
                    actual, expected, message);
    }
    if (expected != null) {
        var comparator = comparators[getClass(expected)];
        if (comparator)
            return comparator(actual, expected, message, options);
        if (expected.equals)
            return QUnit.push(expected.equals(actual),
                    actual, expected, message);
    }
    QUnit.push(actual === expected, actual, expected, message);
}

function test(testName, expected) {
    return QUnit.test(testName, function() {
        var project = new Project();
        expected();
        project.remove();
    });
}

function asyncTest(testName, expected) {
    return QUnit.asyncTest(testName, function() {
        var project = new Project();
        expected(function() {
            project.remove();
            start();
        });
    });
}

function comparePoints(point1, point2, message, options) {
    equals(point1.x, point2.x, (message || '') + ' x', options);
    equals(point1.y, point2.y, (message || '') + ' y', options);
}

function compareSize(size1, size2, message, options) {
    equals(size1.width, size2.width, (message || '') + ' width', options);
    equals(size1.height, size2.height, (message || '') + ' height', options);
}

function compareRectangles(rect1, rect2, message, options) {
    comparePoints(rect1, rect2, message, options);
    compareSize(rect1, rect2, message, options);
}

function compareColors(color1, color2, message, options) {
    color1 = color1 && new Color(color1);
    color2 = color2 && new Color(color2);
    if (color1 && color2) {
        equals(color1.type, color2.type,
                (message || '') + ' type', options);
        equals(color1.components, color2.components,
                (message || '') + ' components', options);
    } else {
        equals(color1, color2, message, options);
    }
}

function compareStyles(style, style2, options) {
    var checkIdentity = options && options.checkIdentity;
    if (checkIdentity) {
        equals(function() {
            return style !== style2;
        }, true);
    }
    Base.each(['fillColor', 'strokeColor'], function(key) {
        if (style[key]) {
            // The color should not point to the same color object:
            if (checkIdentity) {
                equals(function() {
                    return style[key] !== style2[key];
                }, true, 'The ' + key
                        + ' should not point to the same color object:');
            }
            if (style[key] instanceof Color) {
                if (style[key].type === 'gradient' && checkIdentity) {
                    equals(function() {
                        return style[key].gradient === style2[key].gradient;
                    }, true, 'The ' + key
                            + '.gradient should point to the same object:');
                }
                compareColors(style[key], style2[key],
                        'Compare Style#' + key);
            } else {
                equals(style[key] && style[key].toString(),
                        style2[key] && style2[key].toString(),
                        'Compare Style#' + key);
            }
        }
    });

    compareObjects(['strokeCap', 'strokeJoin', 'dashArray', 'dashOffset',
            'miterLimit', 'strokeOverprint', 'fillOverprint',
            'fontSize', 'font', 'leading', 'justification'],
            style, style2, 'Compare Style', options);
}

function compareObjects(keys, obj, obj2, message, options) {
    if (options && options.checkIdentity) {
        equals(function() {
            return obj !== obj2;
        }, true);
    }
    Base.each(keys, function(key) {
        equals(obj[key], obj2[key], message + '#' + key, options);
    });
}

function compareSegmentPoints(segmentPoint, segmentPoint2, options) {
    compareObjects(['x', 'y', 'selected'], segmentPoint, segmentPoint2,
            'Compare SegmentPoint', options);
}

function compareSegments(segment, segment2, options) {
    if (options.checkIdentity) {
        equals(function() {
            return segment !== segment2;
        }, true);
    }
    equals(function() {
        return segment.selected == segment2.selected;
    }, true);
    Base.each(['handleIn', 'handleOut', 'point'], function(key) {
        compareSegmentPoints(segment[key], segment2[key]);
    });
}

function compareSegmentLists(segmentList, segmentList2, options) {
    var checkIdentity = options && options.checkIdentity;
    if (checkIdentity) {
        equals(function() {
            return segmentList !== segmentList2;
        }, true);
    }
    equals(segmentList.toString(), segmentList2.toString(),
            'Compare Item#segments');
    if (checkIdentity) {
        for (var i = 0, l = segmentList.length; i < l; i++) {
            var segment = segmentList[i],
                segment2 = segmentList2[i];
            compareSegments(segment, segment2, options);
        }
    }
}

function compareItems(item, item2, options) {
    var checkIdentity = options && options.checkIdentity;
    if (checkIdentity) {
        equals(function() {
            return item !== item2;
        }, true);

        equals(function() {
            return item.id !== item2.id;
        }, true);
    }

    equals(function() {
        return item.constructor == item2.constructor;
    }, true);

    var itemProperties = ['opacity', 'locked', 'visible', 'blendMode', 'name',
            'selected', 'clipMask', 'guide'];
    Base.each(itemProperties, function(key) {
        var value = item[key];
        // When item was cloned and had a name, the name will be versioned
        equals(
            key == 'name' && options && options.cloned && value
                ? value + ' 1'
                : value,
            item2[key],
            'compare Item#' + key);
    });

    if (checkIdentity) {
        equals(function() {
            return item.bounds !== item2.bounds;
        }, true);
    }

    equals(item.bounds.toString(), item2.bounds.toString(),
            'Compare Item#bounds');

    if (checkIdentity) {
        equals(function() {
            return item.position !== item2.position;
        }, true);
    }

    equals(item.position.toString(), item2.position.toString(),
            'Compare Item#position');

    equals(function() {
        return Base.equals(item.data, item2.data);
    }, true);

    if (item.matrix) {
        if (checkIdentity) {
            equals(function() {
                return item.matrix !== item2.matrix;
            }, true);
        }
        equals(item.matrix.toString(), item2.matrix.toString(),
                'Compare Item#matrix');
    }

    // Path specific
    if (item instanceof Path) {
        var keys = ['closed', 'fullySelected', 'clockwise'];
        for (var i = 0, l = keys.length; i < l; i++) {
            var key = keys[i];
            equals(item[key], item2[key], 'Compare Path#' + key);
        }
        equals(item.length, item2.length, 'Compare Path#length');
        compareSegmentLists(item.segments, item2.segments, options);
    }

    // Shape specific
    if (item instanceof Shape) {
        var keys = ['shape', 'size', 'radius'];
        for (var i = 0, l = keys.length; i < l; i++) {
            var key = keys[i];
            equals(item[key], item2[key], 'Compare Shape#' + key);
        }
    }

    // Group specific
    if (item instanceof Group) {
        equals(function() {
            return item.clipped == item2.clipped;
        }, true);
    }

    // Layer specific
    if (item instanceof Layer) {
        equals(function() {
            return options && options.dontShareProject
                    ? item.project != item2.project
                    : item.project == item2.project;
        }, true);
    }

    // PlacedSymbol specific
    if (item instanceof PlacedSymbol) {
        if (options.dontShareProject) {
            compareItems(item.symbol.definition, item2.symbol.definition,
                    options,
                    'Compare Symbol#definition');
        } else {
            equals(function() {
                return item.symbol == item2.symbol;
            }, true);
        }
    }

    // Raster specific
    if (item instanceof Raster) {
        equals(item.size.toString(), item2.size.toString(),
                'Compare Raster#size');
        equals(item.width, item2.width, 'Compare Raster#width');
        equals(item.height, item2.height, 'Compare Raster#height');

        equals(item.ppi.toString(), item2.ppi.toString(),
                'Compare Raster#ppi');

        equals(item.source, item2.source, 'Compare Raster#source');
        if (options.checkIdentity) {
            equals(item.image, item2.image, 'Compare Raster#image');
        }
        equals(item.size.toString(), item2.size.toString(),
                'Compare Raster#size');
        equals(item.toDataURL() == item2.toDataURL(), true,
                'Compare Raster#toDataUrl()');
    }

    // TextItem specific:
    if (item instanceof TextItem) {
        equals(item.content, item2.content, 'Compare Item#content');
    }

    // PointText specific:
    if (item instanceof PointText) {
        if (options.checkIdentity) {
            equals(function() {
                return item.point !== item2.point;
            }, true);
        }
        equals(item.point.toString(), item2.point.toString(),
                'Compare Item#point');
    }

    if (item.style) {
        // Style
        compareStyles(item.style, item2.style, options);
    }

    // Check length of children and recursively compare them:
    if (item.children) {
        equals(function() {
            return item.children.length == item2.children.length;
        }, true);
        for (var i = 0, l = item.children.length; i < l; i++) {
            compareItems(item.children[i], item2.children[i], options);
        }
    }
}

function compareProjects(project, project2) {
    // Compare Project#symbols:
    equals(function() {
        return project.symbols.length == project2.symbols.length;
    }, true);
    for (var i = 0, l = project.symbols.length; i < l; i++) {
        var definition1 = project.symbols[i].definition;
        var definition2 = project2.symbols[i].definition;
        compareItems(definition1, definition2, { dontShareProject: true },
                'Compare Symbol#definition');
    }

    // Compare Project#layers:
    equals(function() {
        return project.layers.length == project2.layers.length;
    }, true);
    for (var i = 0, l = project.layers.length; i < l; i++) {
        compareItems(project.layers[i], project2.layers[i],
                { dontShareProject: true });
    }
}

// SVG

function createSVG(xml) {
    return new DOMParser().parseFromString(
        '<svg xmlns="http://www.w3.org/2000/svg">' + xml + '</svg>',
        'text/xml');
}
