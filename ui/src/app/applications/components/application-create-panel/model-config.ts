// Full support matrix: model -> system -> backend -> version -> modes[]
// Only PASS combinations from the AIConfigurator support matrix are included.
// To update, replace this with new CSV data from https://ai-dynamo.github.io/aiconfigurator/support-matrix/
export const SUPPORT_MATRIX: Record<string, Record<string, Record<string, Record<string, string[]>>>> = {
    'Qwen/Qwen3-0.6B': {
        a100_sxm: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        },
        b200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.14.1': ['agg', 'disagg']
            }
        },
        gb200: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.1.0': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg'],
                '1.2.0rc6': ['agg', 'disagg']
            },
            vllm: {
                '0.14.0': ['agg', 'disagg']
            }
        },
        gb300: {
            sglang: {
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc6.post3': ['agg', 'disagg']
            }
        },
        h100_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.8.post1': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        },
        h200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg']
            }
        },
        l40s: {
            sglang: {
                '0.5.5.post3': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        }
    },
    'Qwen/Qwen3-1.7B': {
        a100_sxm: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        },
        b200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.14.1': ['agg', 'disagg']
            }
        },
        gb200: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.1.0': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg'],
                '1.2.0rc6': ['agg', 'disagg']
            },
            vllm: {
                '0.14.0': ['agg', 'disagg']
            }
        },
        gb300: {
            sglang: {
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc6.post3': ['agg', 'disagg']
            }
        },
        h100_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.8.post1': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        },
        h200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg']
            }
        },
        l40s: {
            sglang: {
                '0.5.5.post3': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        }
    },
    'Qwen/Qwen3-235B-A22B': {
        a100_sxm: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        },
        b200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.14.1': ['agg', 'disagg']
            }
        },
        gb200: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg'],
                '1.2.0rc6': ['agg', 'disagg']
            },
            vllm: {
                '0.14.0': ['agg', 'disagg']
            }
        },
        gb300: {
            sglang: {
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc6.post3': ['agg', 'disagg']
            }
        },
        h100_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.8.post1': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        },
        h200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg']
            }
        }
    },
    'Qwen/Qwen3-235B-A22B-FP8': {
        b200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.14.1': ['agg', 'disagg']
            }
        },
        gb200: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc6': ['agg', 'disagg']
            },
            vllm: {
                '0.14.0': ['agg', 'disagg']
            }
        },
        gb300: {
            sglang: {
                '0.5.9': ['agg', 'disagg']
            }
        },
        h100_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.8.post1': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        },
        h200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg']
            }
        }
    },
    'Qwen/Qwen3-30B-A3B': {
        a100_sxm: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        },
        b200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.14.1': ['agg', 'disagg']
            }
        },
        gb200: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc5': ['agg', 'disagg'],
                '1.2.0rc6': ['agg', 'disagg']
            },
            vllm: {
                '0.14.0': ['agg', 'disagg']
            }
        },
        gb300: {
            sglang: {
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc6.post3': ['agg', 'disagg']
            }
        },
        h100_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.8.post1': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        },
        h200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg']
            }
        },
        l40s: {
            sglang: {
                '0.5.5.post3': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        }
    },
    'Qwen/Qwen3-30B-A3B-FP8': {
        b200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.14.1': ['agg', 'disagg']
            }
        },
        gb200: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc6': ['agg', 'disagg']
            },
            vllm: {
                '0.14.0': ['agg', 'disagg']
            }
        },
        gb300: {
            sglang: {
                '0.5.9': ['agg', 'disagg']
            }
        },
        h100_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.8.post1': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        },
        h200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg']
            }
        }
    },
    'Qwen/Qwen3-32B': {
        a100_sxm: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        },
        b200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.14.1': ['agg', 'disagg']
            }
        },
        gb200: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.1.0': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg'],
                '1.2.0rc6': ['agg', 'disagg']
            },
            vllm: {
                '0.14.0': ['agg', 'disagg']
            }
        },
        gb300: {
            sglang: {
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc6.post3': ['agg', 'disagg']
            }
        },
        h100_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.8.post1': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        },
        h200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg']
            }
        },
        l40s: {
            sglang: {
                '0.5.5.post3': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        }
    },
    'Qwen/Qwen3-32B-FP8': {
        b200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.14.1': ['agg', 'disagg']
            }
        },
        gb200: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc6': ['agg', 'disagg']
            },
            vllm: {
                '0.14.0': ['agg', 'disagg']
            }
        },
        gb300: {
            sglang: {
                '0.5.9': ['agg', 'disagg']
            }
        },
        h100_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.8.post1': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        },
        h200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg']
            }
        }
    },
    'Qwen/Qwen3-32B-FP8-Static-PerTensor': {
        b200_sxm: {
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            }
        },
        gb200: {
            trtllm: {
                '1.1.0': ['agg', 'disagg']
            }
        },
        gb300: {
            trtllm: {
                '1.2.0rc6.post3': ['agg', 'disagg']
            }
        },
        h100_sxm: {
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            }
        },
        h200_sxm: {
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            }
        }
    },
    'Qwen/Qwen3-8B': {
        a100_sxm: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        },
        b200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.14.1': ['agg', 'disagg']
            }
        },
        gb200: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.1.0': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg'],
                '1.2.0rc6': ['agg', 'disagg']
            },
            vllm: {
                '0.14.0': ['agg', 'disagg']
            }
        },
        gb300: {
            sglang: {
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc6.post3': ['agg', 'disagg']
            }
        },
        h100_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.8.post1': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        },
        h200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg']
            }
        },
        l40s: {
            sglang: {
                '0.5.5.post3': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        }
    },
    'Qwen/Qwen3-Coder-480B-A35B-Instruct': {
        b200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.14.1': ['agg', 'disagg']
            }
        },
        gb200: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg'],
                '1.2.0rc6': ['agg', 'disagg']
            },
            vllm: {
                '0.14.0': ['agg', 'disagg']
            }
        },
        gb300: {
            sglang: {
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc6.post3': ['agg', 'disagg']
            }
        },
        h200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg']
            }
        }
    },
    'deepseek-ai/DeepSeek-V3': {
        b200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc5': ['agg', 'disagg']
            }
        },
        gb200: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc6': ['agg', 'disagg']
            }
        },
        gb300: {
            sglang: {
                '0.5.9': ['agg', 'disagg']
            }
        },
        h200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            }
        }
    },
    'meta-llama/Meta-Llama-3.1-405B': {
        b200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.14.1': ['agg', 'disagg']
            }
        },
        gb300: {
            trtllm: {
                '1.2.0rc6.post3': ['agg', 'disagg']
            }
        },
        h200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg']
            }
        }
    },
    'meta-llama/Meta-Llama-3.1-70B': {
        a100_sxm: {
            trtllm: {
                '1.0.0': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        },
        b200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.14.1': ['agg', 'disagg']
            }
        },
        gb200: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.1.0': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg'],
                '1.2.0rc6': ['agg', 'disagg']
            },
            vllm: {
                '0.14.0': ['agg', 'disagg']
            }
        },
        gb300: {
            sglang: {
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc6.post3': ['agg', 'disagg']
            }
        },
        h100_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.8.post1': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        },
        h200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg']
            }
        },
        l40s: {
            sglang: {
                '0.5.5.post3': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        }
    },
    'meta-llama/Meta-Llama-3.1-8B': {
        a100_sxm: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        },
        b200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.14.1': ['agg', 'disagg']
            }
        },
        gb200: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.1.0': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg'],
                '1.2.0rc6': ['agg', 'disagg']
            },
            vllm: {
                '0.14.0': ['agg', 'disagg']
            }
        },
        gb300: {
            sglang: {
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc6.post3': ['agg', 'disagg']
            }
        },
        h100_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.8.post1': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        },
        h200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg']
            }
        },
        l40s: {
            sglang: {
                '0.5.5.post3': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        }
    },
    'nvidia/DeepSeek-V3.1-NVFP4': {
        b200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            }
        },
        gb200: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg'],
                '1.2.0rc6': ['agg', 'disagg']
            }
        },
        gb300: {
            sglang: {
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc6.post3': ['agg', 'disagg']
            }
        }
    },
    'nvidia/Llama-3.1-70B-Instruct-FP8': {
        b200_sxm: {
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.14.1': ['agg', 'disagg']
            }
        },
        gb200: {
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.1.0': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg'],
                '1.2.0rc6': ['agg', 'disagg']
            },
            vllm: {
                '0.14.0': ['agg', 'disagg']
            }
        },
        gb300: {
            trtllm: {
                '1.2.0rc6.post3': ['agg', 'disagg']
            }
        },
        h100_sxm: {
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        },
        h200_sxm: {
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg']
            }
        },
        l40s: {
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        }
    },
    'nvidia/Llama-3_3-Nemotron-Super-49B-v1': {
        a100_sxm: {
            trtllm: {
                '1.0.0': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        },
        b200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.14.1': ['agg', 'disagg']
            }
        },
        gb200: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.1.0': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg'],
                '1.2.0rc6': ['agg', 'disagg']
            },
            vllm: {
                '0.14.0': ['agg', 'disagg']
            }
        },
        gb300: {
            sglang: {
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc6.post3': ['agg', 'disagg']
            }
        },
        h100_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.8.post1': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        },
        h200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg']
            }
        },
        l40s: {
            sglang: {
                '0.5.5.post3': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        }
    },
    'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16': {
        a100_sxm: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            vllm: {
                '0.14.0': ['agg', 'disagg']
            }
        },
        b200_sxm: {
            sglang: {
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.14.1': ['agg', 'disagg']
            }
        },
        gb200: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc5': ['agg', 'disagg'],
                '1.2.0rc6': ['agg', 'disagg']
            },
            vllm: {
                '0.14.0': ['agg', 'disagg']
            }
        },
        gb300: {
            sglang: {
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc6.post3': ['agg', 'disagg']
            }
        },
        h100_sxm: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg']
            }
        },
        h200_sxm: {
            sglang: {
                '0.5.9': ['agg', 'disagg']
            }
        },
        l40s: {
            sglang: {
                '0.5.9': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        }
    },
    'nvidia/NVIDIA-Nemotron-3-Super-120B-NVFP4-FP8KV': {
        b200_sxm: {
            sglang: {
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.14.1': ['agg', 'disagg']
            }
        },
        gb200: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc5': ['agg', 'disagg'],
                '1.2.0rc6': ['agg', 'disagg']
            },
            vllm: {
                '0.14.0': ['agg', 'disagg']
            }
        },
        gb300: {
            sglang: {
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc6.post3': ['agg', 'disagg']
            }
        }
    },
    'nvidia/Nemotron-H-56B-Base-8K': {
        a100_sxm: {
            trtllm: {
                '1.0.0': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        },
        b200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.14.1': ['agg', 'disagg']
            }
        },
        gb200: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.1.0': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg'],
                '1.2.0rc6': ['agg', 'disagg']
            },
            vllm: {
                '0.14.0': ['agg', 'disagg']
            }
        },
        gb300: {
            sglang: {
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc6.post3': ['agg', 'disagg']
            }
        },
        h100_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.8.post1': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        },
        h200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc3': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg']
            }
        },
        l40s: {
            sglang: {
                '0.5.5.post3': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0': ['agg', 'disagg']
            },
            vllm: {
                '0.12.0': ['agg', 'disagg'],
                '0.14.0': ['agg', 'disagg']
            }
        }
    },
    'nvidia/Qwen3-235B-A22B-NVFP4': {
        b200_sxm: {
            sglang: {
                '0.5.6.post2': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg']
            },
            vllm: {
                '0.14.1': ['agg', 'disagg']
            }
        },
        gb200: {
            sglang: {
                '0.5.8.post1': ['agg', 'disagg'],
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.0.0rc6': ['agg', 'disagg'],
                '1.2.0rc5': ['agg', 'disagg'],
                '1.2.0rc6': ['agg', 'disagg']
            },
            vllm: {
                '0.14.0': ['agg', 'disagg']
            }
        },
        gb300: {
            sglang: {
                '0.5.9': ['agg', 'disagg']
            },
            trtllm: {
                '1.2.0rc6.post3': ['agg', 'disagg']
            }
        }
    },
    'openai/gpt-oss-120b': {
        h100_sxm: {
            trtllm: {
                '1.2.0rc5': ['agg', 'disagg']
            }
        },
        h200_sxm: {
            trtllm: {
                '1.2.0rc5': ['agg', 'disagg']
            }
        }
    },
    'openai/gpt-oss-20b': {
        h100_sxm: {
            trtllm: {
                '1.2.0rc5': ['agg', 'disagg']
            }
        },
        h200_sxm: {
            trtllm: {
                '1.2.0rc5': ['agg', 'disagg']
            }
        }
    }
};

export const MODELS = Object.keys(SUPPORT_MATRIX);

export function getSystems(model: string): string[] {
    return model && SUPPORT_MATRIX[model] ? Object.keys(SUPPORT_MATRIX[model]) : [];
}

export function getBackends(model: string, system: string): string[] {
    return model && system && SUPPORT_MATRIX[model]?.[system] ? Object.keys(SUPPORT_MATRIX[model][system]) : [];
}

export function getBackendVersions(model: string, system: string, backend: string): string[] {
    return model && system && backend && SUPPORT_MATRIX[model]?.[system]?.[backend] ? Object.keys(SUPPORT_MATRIX[model][system][backend]) : [];
}

export function getModes(model: string, system: string, backend: string, version: string): string[] {
    return model && system && backend && version && SUPPORT_MATRIX[model]?.[system]?.[backend]?.[version] ? SUPPORT_MATRIX[model][system][backend][version] : [];
}

export function isCombinationValid(model: string, system: string, backend: string, version: string, mode: string): boolean {
    if (!model || !system || !backend || !version || !mode) {
        return true; // incomplete selection is not invalid
    }
    const modes = SUPPORT_MATRIX[model]?.[system]?.[backend]?.[version];
    return modes ? modes.includes(mode) : false;
}
