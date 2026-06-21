// Node.js script to inspect TourbillonMainSystem.glb
// Run: node inspect_glb.mjs

import { readFileSync } from 'fs'

const filePath = './public/TourbillonMainSystem.glb'
const buffer = readFileSync(filePath)

// GLB binary format: 12-byte header, then chunks
// Header: magic(4), version(4), length(4)
// Chunk: chunkLength(4), chunkType(4), chunkData(n)
// ChunkType 0x4E4F534A = JSON, 0x004E4942 = BIN

const magic = buffer.readUInt32LE(0)
const version = buffer.readUInt32LE(4)
const totalLength = buffer.readUInt32LE(8)

console.log(`GLB Magic: 0x${magic.toString(16)} (should be 0x46546c67 = glTF)`)
console.log(`Version: ${version}`)
console.log(`Total length: ${totalLength}`)

// First chunk (JSON)
const chunk0Length = buffer.readUInt32LE(12)
const chunk0Type = buffer.readUInt32LE(16)
console.log(`\nChunk 0: type=0x${chunk0Type.toString(16)} length=${chunk0Length}`)

if (chunk0Type === 0x4E4F534A) { // JSON
  const jsonStr = buffer.slice(20, 20 + chunk0Length).toString('utf8')
  const gltf = JSON.parse(jsonStr)

  console.log(`\n=== NODES (${gltf.nodes?.length ?? 0} total) ===`)
  if (gltf.nodes) {
    gltf.nodes.forEach((node, i) => {
      const meshInfo = node.mesh !== undefined ? ` [MESH idx=${node.mesh}]` : ''
      const childrenInfo = node.children?.length ? ` [children: ${node.children.join(',')}]` : ''
      console.log(`  [${i}] "${node.name ?? '(unnamed)'}"${meshInfo}${childrenInfo}`)
    })
  }

  console.log(`\n=== MESHES (${gltf.meshes?.length ?? 0} total) ===`)
  if (gltf.meshes) {
    gltf.meshes.forEach((mesh, i) => {
      const prims = mesh.primitives?.length ?? 0
      const mats = mesh.primitives?.map(p => p.material).join(',') ?? 'none'
      console.log(`  [${i}] "${mesh.name ?? '(unnamed)'}" — ${prims} primitives, materials: [${mats}]`)
    })
  }

  console.log(`\n=== MATERIALS (${gltf.materials?.length ?? 0} total) ===`)
  if (gltf.materials) {
    gltf.materials.forEach((mat, i) => {
      console.log(`  [${i}] "${mat.name ?? '(unnamed)'}"`)
    })
  }

  // Show hierarchy from scene roots
  console.log(`\n=== SCENE HIERARCHY ===`)
  const scenes = gltf.scenes ?? []
  scenes.forEach((scene, si) => {
    console.log(`Scene [${si}]: "${scene.name ?? '(unnamed)'}"`)
    const printNode = (nodeIdx, indent) => {
      const node = gltf.nodes[nodeIdx]
      if (!node) return
      const meshName = node.mesh !== undefined ? ` → mesh:"${gltf.meshes[node.mesh]?.name ?? '?'}"` : ''
      console.log(`${indent}[${nodeIdx}] "${node.name ?? '(unnamed)'}"${meshName}`)
      node.children?.forEach(childIdx => printNode(childIdx, indent + '  '))
    }
    scene.nodes?.forEach(rootIdx => printNode(rootIdx, '  '))
  })

  // Search specifically for InnerRing
  console.log(`\n=== SEARCH: "InnerRing" / "Alquimia" ===`)
  const found = []
  gltf.nodes?.forEach((node, i) => {
    const name = node.name ?? ''
    if (name.toLowerCase().includes('innerring') || name.toLowerCase().includes('alquimia')) {
      const meshName = node.mesh !== undefined ? gltf.meshes[node.mesh]?.name : null
      found.push({ nodeIdx: i, nodeName: name, meshIdx: node.mesh, meshName })
    }
  })
  found.forEach(f => console.log(`  Node[${f.nodeIdx}] "${f.nodeName}" → mesh[${f.meshIdx}] "${f.meshName ?? 'N/A'}"`))
  if (found.length === 0) console.log('  (none found)')

} else {
  console.log('First chunk is not JSON!')
}
