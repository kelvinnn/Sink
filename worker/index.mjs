// Worker entry: the Nitro build wrapped with the optional admin gate (see admin-gate.mjs).
import nitro from '../.output/server/index.mjs'
import { withAdminGate } from './admin-gate.mjs'

export default withAdminGate(nitro)
