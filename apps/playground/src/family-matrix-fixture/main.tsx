import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { FamilyMatrixApp } from '../family-matrix/FamilyMatrixApp.tsx'
import '../family-matrix/family-matrix.css'

const root = document.querySelector('#root')
if (root === null) throw new Error('family matrix root is missing')

createRoot(root).render(
  <StrictMode>
    <FamilyMatrixApp />
  </StrictMode>,
)
