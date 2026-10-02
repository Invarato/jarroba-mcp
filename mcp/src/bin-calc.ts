#!/usr/bin/env node
import { fijarDominios } from "./arranque";
fijarDominios("calc");
await import("./server");
