var deepslateResources;
const { mat4, vec3 } = glMatrix;

document.addEventListener("DOMContentLoaded", function(event) {
  const image = document.getElementById('atlas');
  if (image.complete) {
    loadResources(image);
  } else {
    image.addEventListener('load', () => loadResources(image));
  }

});

// Taken from Deepslate examples
// TODO: Pass in assets.js and opaque.js
function loadResources(textureImage) {
  const blockDefinitions = {};
  Object.keys(assets.blockstates).forEach(id => {
    blockDefinitions['minecraft:' + id] = deepslate.BlockDefinition.fromJson(id, assets.blockstates[id]);
  })

  const blockModels = {};
  Object.keys(assets.models).forEach(id => {
    blockModels['minecraft:' + id] = deepslate.BlockModel.fromJson(id, assets.models[id]);
  })
  Object.values(blockModels).forEach(m => m.flatten({ getBlockModel: id => blockModels[id] }));

  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = textureImage.width;
  atlasCanvas.height = textureImage.height;
  const atlasCtx = atlasCanvas.getContext('2d');
  atlasCtx.drawImage(textureImage, 0, 0);
  const atlasData = atlasCtx.getImageData(0, 0, atlasCanvas.width, atlasCanvas.height);
  const part = 16 / atlasData.width;
  const idMap = {};
  Object.keys(assets.textures).forEach(id => {
    const [u, v] = assets.textures[id];
    idMap['minecraft:' + id] = [u, v, u + part, v + part];
  })
  const textureAtlas = new deepslate.TextureAtlas(atlasData, idMap);

  deepslateResources = {
    getBlockDefinition(id) { return blockDefinitions[id] },
    getBlockModel(id) { return blockModels[id] },
    getTextureUV(id) { return textureAtlas.getTextureUV(id) },
    getTextureAtlas() { return textureAtlas.getTextureAtlas() },
    getBlockFlags(id) { return { opaque: opaqueBlocks.has(id) } },
    getBlockProperties(id) { return null },
    getDefaultBlockProperties(id) { return null },
  }
}

function createRenderer(structure) {

  const canvasContainer = document.getElementById('canvas-container');
  const canvas = document.createElement('canvas');
  canvasContainer.appendChild(canvas);
  // Make it visually fill the positioned parent
  canvas.style.width  = '100%';
  canvas.style.height = '100%';
  // ...then set the internal size to match
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetWidth*0.75; // 4:3 aspect ratio

  //const canvas = document.getElementById('render-canvas');

  const gl = canvas.getContext('webgl');

  // Need chunksize 8 as seems to be a max number of faces per chunk that will render
  const renderer = new deepslate.StructureRenderer(gl, structure, deepslateResources, options={chunkSize: 8});

  // Crappy controls
  const size = structure.getSize();

  const center = vec3.fromValues(-size[0] / 2, -size[1] / 2, -size[2] / 2);
  const cameraPos = vec3.fromValues(0, 0, Math.max(size[0], size[1]) + size[2] / 2);
  // Just to have somewhere to store the negative of the camera.
  const minusCam = vec3.create();

  const rotate = mat4.create();
  const view = mat4.create();

  mat4.translate(rotate, rotate, vec3.negate(minusCam, cameraPos));


  function render() {
    mat4.translate(view, rotate, center)
    renderer.drawStructure(view);
    renderer.drawGrid(view);
  }
  requestAnimationFrame(render);


  let mousePos = null;
  canvas.addEventListener('mousedown', evt => {
    if (evt.button === 0) {
      evt.preventDefault();
      mousePos = [evt.clientX, evt.clientY];
    }
  })
  canvas.addEventListener('mousemove', evt => {
    if (mousePos) {
      mat4.rotateY(rotate, rotate, (evt.clientX - mousePos[0]) / 200);
      mousePos = [evt.clientX, evt.clientY];

      requestAnimationFrame(render);
    }
  })

  const stop = evt => {
    mousePos = null;
    evt.preventDefault();
  }
  canvas.addEventListener('mouseup', stop)
  canvas.addEventListener('mouseout', stop)

}

function structureFromLitematic(litematic) {
  var blocks = litematic.regions[0].blocks;
  var blockPalette = litematic.regions[0].blockPalette;

  // Could probably make an intermediate block array type for this
  // Does js have good 3D arrays?
  width = blocks.length;
  height = blocks[0].length;
  depth = blocks[0][0].length;

  const structure = new deepslate.Structure([width, height, depth]);

  /*
  // Example blocks
  structure.addBlock([1, 0, 0], "minecraft:stone")
  structure.addBlock([2, 0, 0], "minecraft:grass_block", { "snowy": "false" });
  structure.addBlock([1, 1, 0], "minecraft:cake", { "bites": "3" })
  structure.addBlock([0, 0, 0], "minecraft:wall_torch", { "facing": "west" });
  structure.addBlock([2, 1, 0], "minecraft:scaffolding", { "bottom": "false", "waterlogged": "true", "distance": "0" });
  */

  // Add blocks manually from the blocks loaded from the NBT
  var blockCount = 0
  console.log("Building blocks...");
  for (let x=0; x < width; x++) {
    for (let y=0; y < height; y++) {
      for (let z=0; z < depth; z++) {
        blockID = blocks[x][y][z];
        if (blockID > 0) { // Skip air-blocks

          if(blockID < blockPalette.length) {
            blockInfo = blockPalette[blockID];
            blockName = blockInfo.Name;
            blockCount++;

            if (blockInfo.hasOwnProperty("Properties")) {
              structure.addBlock([x, y, z], blockName, blockInfo.Properties);
            } else {
              structure.addBlock([x, y, z], blockName);
            }

          } else {
            // Something obvious so we know when things go wrong
            structure.addBlock([x, y, z], "minecraft:stone")
          }
        }
      }
    }
  }
  console.log("Done!", blockCount, " blocks created");

  return structure;
}
