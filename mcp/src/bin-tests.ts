#!/usr/bin/env node
import { fijarDominios } from "./arranque";
fijarDominios("tests");
await import("./server");
