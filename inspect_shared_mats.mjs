// Node.js script to find which nodes share material [13] "InnerRingEast"
// Run: node inspect_shared_mats.mjs

import { readFileSync } from 'fs'

const filePath = './public/TourbillonMainSystem.glb'
const buffer = readFileSync(filePath)

const chunk0Length = buffer.readUInt32LE(12)
const jsonStr = buffer.slice(20, 20 + chunk0Length).toString('utf8')
const gltf = JSON.parse(jsonStr)

// Find all meshes using material 13 ("InnerRingEast")
console.log('=== Meshes using material [13] "InnerRingEast" ===')
gltf.meshes?.forEach((mesh, meshIdx) => {
  mesh.primitives?.forEach((prim, primIdx) => {
    if (prim.material === 13) {
      console.log(`  Mesh[${meshIdx}] "${mesh.name ?? '(unnamed)'}" primitive[${primIdx}]`)
    }
  })
})

// Find all nodes referencing those meshes
console.log('\n=== Nodes pointing to meshes with material [13] ===')
const targetMeshIndices = new Set()
gltf.meshes?.forEach((mesh, meshIdx) => {
  if (mesh.primitives?.some(p => p.material === 13)) {
    targetMeshIndices.add(meshIdx)
  }
})

// Build parent map
const parentMap = {}
gltf.nodes?.forEach((node, idx) => {
  node.children?.forEach(childIdx => {
    parentMap[childIdx] = idx
  })
})

const getAncestors = (nodeIdx) => {
  const chain = []
  let curr = nodeIdx
  while (curr !== undefined && curr !== null) {
    const node = gltf.nodes[curr]
    chain.push(`[${curr}] "${node?.name ?? '(unnamed)'}"`)
    curr = parentMap[curr]
  }
  return chain
}

gltf.nodes?.forEach((node, nodeIdx) => {
  if (node.mesh !== undefined && targetMeshIndices.has(node.mesh)) {
    const ancestors = getAncestors(nodeIdx)
    console.log(`  Node[${nodeIdx}] "${node.name ?? '(unnamed)'}" → Mesh[${node.mesh}]`)
    console.log(`    Ancestry: ${ancestors.join(' ← ')}`)
  }
})

// Also check all material usage across the file
console.log('\n=== Full material usage table ===')
gltf.materials?.forEach((mat, matIdx) => {
  const users = []
  gltf.nodes?.forEach((node, nodeIdx) => {
    if (node.mesh !== undefined) {
      const mesh = gltf.meshes[node.mesh]
      if (mesh?.primitives?.some(p => p.material === matIdx)) {
        users.push(`Node[${nodeIdx}]"${node.name ?? '(unnamed)'}"`)
      }
    }
  })
  if (users.length > 1) {
    console.log(`  Material[${matIdx}] "${mat.name}" → SHARED by ${users.length} nodes:`)
    users.forEach(u => console.log(`    ${u}`))
  }
})
