// imports
const deasync = require('deasync');
const readFileSync = require('fs').readFileSync;
const resolve = require('path').resolve;
const types = require('node-sass').types;
const assign = require('object-assign');
const parse = require('htmlparser2').parseDOM;
const selectAll = require('css-select');
const selectOne = selectAll.selectOne;
const serialize = require('dom-serializer');
const svgo = new (require('svgo'));
const optimize = deasync(optimizeAsync);

const defaultOptions = {optimize: false}

// exports
module.exports = inliner;

/**
 * The SVG inliner function
 * This is a factory that expects a base path abd returns the actual function
 * @param base
 * @param opts {optimize: true/false}
 * @returns {Function}
 */
function inliner(base, opts) {

  opts = assign({}, defaultOptions, opts);

  return function(path, selectors){

    let content = readFileSync(resolve(base, path.getValue()));

    if(selectors && selectors.getLength && selectors.getLength())
      content = changeStyle(content, selectors);

    if(opts.optimize)
      content = new Buffer(optimize(content).data);


    return encode(content);
  }
}


/**
 * encode the string
 * @param content
 * @returns {types.String}
 */
function encode(content){

  return (new types.String('url("data:image/svg+xml;base64,'+content.toString('base64')+'")'));
}


/**
 * change the style of the svg
 * @param source
 * @param styles
 * @returns {*}
 */
function changeStyle(source, selectors){

  const dom = parse(source, { xmlMode: true });
  const svg = dom ? selectOne('svg', dom) : null;

  selectors = mapToObj(selectors);

  if (!svg) {

    throw Error('Invalid svg file');
  }

  Object.keys(selectors).forEach(function (selector) {

    const elements = selectAll(selector, svg);
    let attribs = selectors[selector];

    elements.forEach(function (element) {
      assign(element.attribs, attribs);
    });
  });

  return new Buffer(serialize(dom));
}

/**
 * transform a sass map into a js object
 * @param map
 * @returns {null}
 */
function mapToObj(map){

  const obj = Object.create(null);

  for(let i = 0, len = map.getLength(); i < len; i++){

    const key = map.getKey(i).getValue();
    let value = map.getValue(i);

    switch(value.toString()) {

      case '[object SassMap]':
        value = mapToObj(value);
        break;
      case '[object SassColor]':
        value = 'rgba('+value.getR()+','+value.getG()+','+value.getB()+','+value.getA()+')';
        break;
      default:
        value = value.getValue();
    }

    obj[key] = value;
  }

  return obj;
}


function optimizeAsync(src, cb){
  svgo.optimize(src).then(function(result){
    return cb(null, result)
  }).catch(function(error) {
    throw(error);
  })
}
