#!/usr/bin/env python
"""Minimal trtexec substitute built on the TensorRT Python API (Faza 9, local PoC).

Supports the CLI subset used by Audio2X SDK scripts:
  --onnx=<path> --saveEngine=<path> --device=<n>
  --minShapes=name:dims[,name:dims] --optShapes=... --maxShapes=...
  --fp16 --hardwareCompatibilityLevel=<level> --versionCompatible
  --memPoolSize=<pool>:<gb>  (best-effort; ignored if unknown)
Unknown flags are ignored with a note (no hard failure).
"""
import os
import sys

import tensorrt as trt

TRT_LOGGER = trt.Logger(trt.Logger.WARNING)


def parse_shape_group(value):
    result = {}
    for item in value.split(","):
        if not item:
            continue
        name, dims = item.split(":")
        result[name] = tuple(int(d) for d in dims.split("x"))
    return result


def main(argv):
    onnx = save_engine = None
    mins = opts = maxs = {}
    fp16 = False
    version_compatible = False
    hw_compat = None
    mem_pool = None
    unknown = []

    for arg in argv:
        if arg.startswith("--onnx="):
            onnx = arg.split("=", 1)[1]
        elif arg.startswith("--saveEngine="):
            save_engine = arg.split("=", 1)[1]
        elif arg.startswith("--device="):
            pass
        elif arg.startswith("--minShapes="):
            mins = parse_shape_group(arg.split("=", 1)[1])
        elif arg.startswith("--optShapes="):
            opts = parse_shape_group(arg.split("=", 1)[1])
        elif arg.startswith("--maxShapes="):
            maxs = parse_shape_group(arg.split("=", 1)[1])
        elif arg == "--fp16":
            fp16 = True
        elif arg == "--versionCompatible":
            version_compatible = True
        elif arg.startswith("--hardwareCompatibilityLevel="):
            hw_compat = arg.split("=", 1)[1]
        elif arg.startswith("--memPoolSize="):
            mem_pool = arg.split("=", 1)[1]
        else:
            unknown.append(arg)

    if not onnx or not save_engine:
        print("[trtexec-shim] ERROR: --onnx and --saveEngine are required", file=sys.stderr)
        return 2
    if unknown:
        print(f"[trtexec-shim] ignoring flags: {unknown}")

    builder = trt.Builder(TRT_LOGGER)
    flags = 1 << int(trt.NetworkDefinitionCreationFlag.EXPLICIT_BATCH)
    network = builder.create_network(flags)
    parser = trt.OnnxParser(network, TRT_LOGGER)
    with open(onnx, "rb") as handle:
        if not parser.parse(handle.read()):
            for i in range(parser.num_errors):
                print(parser.get_error(i), file=sys.stderr)
            print("[trtexec-shim] ERROR: ONNX parse failed", file=sys.stderr)
            return 3

    config = builder.create_builder_config()
    config.set_memory_pool_limit(trt.MemoryPoolType.WORKSPACE, 256 * (1 << 20))
    if mem_pool:
        try:
            pool_name, gb = mem_pool.split(":")
            pool_type = getattr(trt.MemoryPoolType, pool_name.upper(), None)
            if pool_type is not None:
                config.set_memory_pool_limit(pool_type, int(float(gb) * (1 << 30)))
        except Exception as exc:  # noqa: BLE001
            print(f"[trtexec-shim] memPoolSize skipped: {exc}")
    if fp16:
        config.set_flag(trt.BuilderFlag.FP16)
    if version_compatible:
        config.set_flag(trt.BuilderFlag.VERSION_COMPATIBLE)
    if hw_compat:
        level_name = hw_compat.replace("+", "_PLUS").upper()
        level = getattr(trt.HardwareCompatibilityLevel, level_name, None)
        if level is None and hw_compat.upper() == "AMPERE+":
            level = trt.HardwareCompatibilityLevel.AMPERE_PLUS
        if level is not None:
            config.hardware_compatibility_level = level
        else:
            print(f"[trtexec-shim] unknown hardwareCompatibilityLevel: {hw_compat}")

    if mins or opts or maxs:
        profile = builder.create_optimization_profile()
        names = set(list(mins) + list(opts) + list(maxs))
        for name in names:
            lo = mins.get(name) or maxs.get(name)
            hi = maxs.get(name) or mins.get(name)
            mid = opts.get(name) or hi
            profile.set_shape(name, lo, mid, hi)
        config.add_optimization_profile(profile)

    serialized = builder.build_serialized_network(network, config)
    if serialized is None:
        print("[trtexec-shim] ERROR: engine build failed", file=sys.stderr)
        return 4

    os.makedirs(os.path.dirname(os.path.abspath(save_engine)), exist_ok=True)
    with open(save_engine, "wb") as handle:
        handle.write(serialized)
    print(f"[trtexec-shim] wrote {save_engine} ({len(serialized)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
