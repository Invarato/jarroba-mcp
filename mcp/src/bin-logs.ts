#!/usr/bin/env node
import { fijarDominios } from "./arranque";
fijarDominios("logs");
await import("./server");
