import type { TacticalRulebook } from './tactical-types';

export const TACTICAL_RULEBOOK: TacticalRulebook = {
  "version": "1.0.0",
  "limits": {
    "formationTiers": [
      0,
      0.04,
      0.08,
      0.12
    ],
    "styleTiers": [
      0,
      0.04,
      0.08
    ],
    "maxMitigation": 0.9,
    "maxAdditionalMistakePenalty": 0.05,
    "maxCombinedPenaltyPerPossession": 0.15,
    "applyTo": "Bước vận hành liên quan của bên bất lợi, đúng một lần cho cùng nguyên nhân; không phải win%."
  },
  "formations": [
    {
      "code": "433_ATT",
      "positions": [
        {
          "position": "GK",
          "x": 50,
          "y": 8
        },
        {
          "position": "LB",
          "x": 15,
          "y": 25
        },
        {
          "position": "CB",
          "x": 38,
          "y": 22
        },
        {
          "position": "CB",
          "x": 62,
          "y": 22
        },
        {
          "position": "RB",
          "x": 85,
          "y": 25
        },
        {
          "position": "DM",
          "x": 50,
          "y": 42
        },
        {
          "position": "CM",
          "x": 32,
          "y": 56
        },
        {
          "position": "CM",
          "x": 68,
          "y": 56
        },
        {
          "position": "LW",
          "x": 18,
          "y": 80
        },
        {
          "position": "ST",
          "x": 50,
          "y": 88
        },
        {
          "position": "RW",
          "x": 82,
          "y": 80
        }
      ]
    },
    {
      "code": "433_DEF",
      "positions": [
        {
          "position": "GK",
          "x": 50,
          "y": 8
        },
        {
          "position": "LB",
          "x": 15,
          "y": 25
        },
        {
          "position": "CB",
          "x": 38,
          "y": 22
        },
        {
          "position": "CB",
          "x": 62,
          "y": 22
        },
        {
          "position": "RB",
          "x": 85,
          "y": 25
        },
        {
          "position": "DM",
          "x": 36,
          "y": 42
        },
        {
          "position": "DM",
          "x": 64,
          "y": 42
        },
        {
          "position": "AM",
          "x": 50,
          "y": 64
        },
        {
          "position": "LW",
          "x": 18,
          "y": 80
        },
        {
          "position": "ST",
          "x": 50,
          "y": 88
        },
        {
          "position": "RW",
          "x": 82,
          "y": 80
        }
      ]
    },
    {
      "code": "4231_MOD",
      "positions": [
        {
          "position": "GK",
          "x": 50,
          "y": 8
        },
        {
          "position": "LB",
          "x": 15,
          "y": 25
        },
        {
          "position": "CB",
          "x": 38,
          "y": 22
        },
        {
          "position": "CB",
          "x": 62,
          "y": 22
        },
        {
          "position": "RB",
          "x": 85,
          "y": 25
        },
        {
          "position": "DM",
          "x": 36,
          "y": 44
        },
        {
          "position": "DM",
          "x": 64,
          "y": 44
        },
        {
          "position": "AM",
          "x": 50,
          "y": 68
        },
        {
          "position": "LAM",
          "x": 18,
          "y": 72
        },
        {
          "position": "RAM",
          "x": 82,
          "y": 72
        },
        {
          "position": "ST",
          "x": 50,
          "y": 88
        }
      ]
    },
    {
      "code": "4231_WIDE",
      "positions": [
        {
          "position": "GK",
          "x": 50,
          "y": 8
        },
        {
          "position": "LB",
          "x": 15,
          "y": 25
        },
        {
          "position": "CB",
          "x": 38,
          "y": 22
        },
        {
          "position": "CB",
          "x": 62,
          "y": 22
        },
        {
          "position": "RB",
          "x": 85,
          "y": 25
        },
        {
          "position": "DM",
          "x": 36,
          "y": 44
        },
        {
          "position": "DM",
          "x": 64,
          "y": 44
        },
        {
          "position": "LM",
          "x": 16,
          "y": 60
        },
        {
          "position": "AM",
          "x": 50,
          "y": 68
        },
        {
          "position": "RM",
          "x": 84,
          "y": 60
        },
        {
          "position": "ST",
          "x": 50,
          "y": 88
        }
      ]
    },
    {
      "code": "442_CLASS",
      "positions": [
        {
          "position": "GK",
          "x": 50,
          "y": 8
        },
        {
          "position": "LB",
          "x": 15,
          "y": 25
        },
        {
          "position": "CB",
          "x": 38,
          "y": 22
        },
        {
          "position": "CB",
          "x": 62,
          "y": 22
        },
        {
          "position": "RB",
          "x": 85,
          "y": 25
        },
        {
          "position": "LM",
          "x": 16,
          "y": 56
        },
        {
          "position": "CM",
          "x": 38,
          "y": 54
        },
        {
          "position": "CM",
          "x": 62,
          "y": 54
        },
        {
          "position": "RM",
          "x": 84,
          "y": 56
        },
        {
          "position": "ST",
          "x": 38,
          "y": 86
        },
        {
          "position": "ST",
          "x": 62,
          "y": 86
        }
      ]
    },
    {
      "code": "41212_NAR",
      "positions": [
        {
          "position": "GK",
          "x": 50,
          "y": 8
        },
        {
          "position": "LB",
          "x": 15,
          "y": 26
        },
        {
          "position": "CB",
          "x": 38,
          "y": 22
        },
        {
          "position": "CB",
          "x": 62,
          "y": 22
        },
        {
          "position": "RB",
          "x": 85,
          "y": 26
        },
        {
          "position": "DM",
          "x": 50,
          "y": 40
        },
        {
          "position": "CM",
          "x": 30,
          "y": 54
        },
        {
          "position": "CM",
          "x": 70,
          "y": 54
        },
        {
          "position": "AM",
          "x": 50,
          "y": 68
        },
        {
          "position": "ST",
          "x": 38,
          "y": 86
        },
        {
          "position": "ST",
          "x": 62,
          "y": 86
        }
      ]
    },
    {
      "code": "41212_WIDE",
      "positions": [
        {
          "position": "GK",
          "x": 50,
          "y": 8
        },
        {
          "position": "LB",
          "x": 15,
          "y": 25
        },
        {
          "position": "CB",
          "x": 38,
          "y": 22
        },
        {
          "position": "CB",
          "x": 62,
          "y": 22
        },
        {
          "position": "RB",
          "x": 85,
          "y": 25
        },
        {
          "position": "DM",
          "x": 50,
          "y": 42
        },
        {
          "position": "LM",
          "x": 16,
          "y": 58
        },
        {
          "position": "RM",
          "x": 84,
          "y": 58
        },
        {
          "position": "AM",
          "x": 50,
          "y": 70
        },
        {
          "position": "ST",
          "x": 38,
          "y": 86
        },
        {
          "position": "ST",
          "x": 62,
          "y": 86
        }
      ]
    },
    {
      "code": "4312_NARROW",
      "positions": [
        {
          "position": "GK",
          "x": 50,
          "y": 8
        },
        {
          "position": "LB",
          "x": 15,
          "y": 26
        },
        {
          "position": "CB",
          "x": 38,
          "y": 22
        },
        {
          "position": "CB",
          "x": 62,
          "y": 22
        },
        {
          "position": "RB",
          "x": 85,
          "y": 26
        },
        {
          "position": "CM",
          "x": 26,
          "y": 48
        },
        {
          "position": "CM",
          "x": 50,
          "y": 46
        },
        {
          "position": "CM",
          "x": 74,
          "y": 48
        },
        {
          "position": "AM",
          "x": 50,
          "y": 68
        },
        {
          "position": "ST",
          "x": 38,
          "y": 86
        },
        {
          "position": "ST",
          "x": 62,
          "y": 86
        }
      ]
    },
    {
      "code": "4321_TREE",
      "positions": [
        {
          "position": "GK",
          "x": 50,
          "y": 8
        },
        {
          "position": "LB",
          "x": 15,
          "y": 26
        },
        {
          "position": "CB",
          "x": 38,
          "y": 22
        },
        {
          "position": "CB",
          "x": 62,
          "y": 22
        },
        {
          "position": "RB",
          "x": 85,
          "y": 26
        },
        {
          "position": "CM",
          "x": 28,
          "y": 46
        },
        {
          "position": "DM",
          "x": 50,
          "y": 42
        },
        {
          "position": "CM",
          "x": 72,
          "y": 46
        },
        {
          "position": "LAM",
          "x": 34,
          "y": 68
        },
        {
          "position": "RAM",
          "x": 66,
          "y": 68
        },
        {
          "position": "ST",
          "x": 50,
          "y": 88
        }
      ]
    },
    {
      "code": "352_WB",
      "positions": [
        {
          "position": "GK",
          "x": 50,
          "y": 8
        },
        {
          "position": "CB",
          "x": 28,
          "y": 22
        },
        {
          "position": "CB",
          "x": 50,
          "y": 20
        },
        {
          "position": "CB",
          "x": 72,
          "y": 22
        },
        {
          "position": "LWB",
          "x": 12,
          "y": 50
        },
        {
          "position": "DM",
          "x": 50,
          "y": 44
        },
        {
          "position": "CM",
          "x": 34,
          "y": 58
        },
        {
          "position": "CM",
          "x": 66,
          "y": 58
        },
        {
          "position": "RWB",
          "x": 88,
          "y": 50
        },
        {
          "position": "SS",
          "x": 38,
          "y": 85
        },
        {
          "position": "ST",
          "x": 62,
          "y": 85
        }
      ]
    },
    {
      "code": "343_FLAT",
      "positions": [
        {
          "position": "GK",
          "x": 50,
          "y": 8
        },
        {
          "position": "CB",
          "x": 28,
          "y": 22
        },
        {
          "position": "CB",
          "x": 50,
          "y": 20
        },
        {
          "position": "CB",
          "x": 72,
          "y": 22
        },
        {
          "position": "LM",
          "x": 14,
          "y": 54
        },
        {
          "position": "CM",
          "x": 38,
          "y": 50
        },
        {
          "position": "CM",
          "x": 62,
          "y": 50
        },
        {
          "position": "RM",
          "x": 86,
          "y": 54
        },
        {
          "position": "LW",
          "x": 20,
          "y": 80
        },
        {
          "position": "ST",
          "x": 50,
          "y": 88
        },
        {
          "position": "RW",
          "x": 80,
          "y": 80
        }
      ]
    },
    {
      "code": "3421_XABI",
      "positions": [
        {
          "position": "GK",
          "x": 50,
          "y": 8
        },
        {
          "position": "CB",
          "x": 28,
          "y": 22
        },
        {
          "position": "CB",
          "x": 50,
          "y": 20
        },
        {
          "position": "CB",
          "x": 72,
          "y": 22
        },
        {
          "position": "LWB",
          "x": 12,
          "y": 52
        },
        {
          "position": "CM",
          "x": 38,
          "y": 48
        },
        {
          "position": "CM",
          "x": 62,
          "y": 48
        },
        {
          "position": "RWB",
          "x": 88,
          "y": 52
        },
        {
          "position": "LAM",
          "x": 32,
          "y": 70
        },
        {
          "position": "RAM",
          "x": 68,
          "y": 70
        },
        {
          "position": "ST",
          "x": 50,
          "y": 88
        }
      ]
    },
    {
      "code": "3412_CLASS",
      "positions": [
        {
          "position": "GK",
          "x": 50,
          "y": 8
        },
        {
          "position": "CB",
          "x": 28,
          "y": 22
        },
        {
          "position": "CB",
          "x": 50,
          "y": 20
        },
        {
          "position": "CB",
          "x": 72,
          "y": 22
        },
        {
          "position": "LWB",
          "x": 12,
          "y": 52
        },
        {
          "position": "CM",
          "x": 38,
          "y": 46
        },
        {
          "position": "CM",
          "x": 62,
          "y": 46
        },
        {
          "position": "RWB",
          "x": 88,
          "y": 52
        },
        {
          "position": "AM",
          "x": 50,
          "y": 66
        },
        {
          "position": "ST",
          "x": 38,
          "y": 86
        },
        {
          "position": "ST",
          "x": 62,
          "y": 86
        }
      ]
    },
    {
      "code": "532_CATENACCIO",
      "positions": [
        {
          "position": "GK",
          "x": 50,
          "y": 8
        },
        {
          "position": "SW",
          "x": 50,
          "y": 18
        },
        {
          "position": "CB",
          "x": 32,
          "y": 24
        },
        {
          "position": "CB",
          "x": 68,
          "y": 24
        },
        {
          "position": "LWB",
          "x": 12,
          "y": 46
        },
        {
          "position": "RWB",
          "x": 88,
          "y": 46
        },
        {
          "position": "DM",
          "x": 50,
          "y": 42
        },
        {
          "position": "CM",
          "x": 34,
          "y": 56
        },
        {
          "position": "CM",
          "x": 66,
          "y": 56
        },
        {
          "position": "SS",
          "x": 38,
          "y": 85
        },
        {
          "position": "ST",
          "x": 62,
          "y": 85
        }
      ]
    },
    {
      "code": "541_BUS",
      "positions": [
        {
          "position": "GK",
          "x": 50,
          "y": 8
        },
        {
          "position": "LWB",
          "x": 12,
          "y": 30
        },
        {
          "position": "CB",
          "x": 30,
          "y": 22
        },
        {
          "position": "CB",
          "x": 50,
          "y": 20
        },
        {
          "position": "CB",
          "x": 70,
          "y": 22
        },
        {
          "position": "RWB",
          "x": 88,
          "y": 30
        },
        {
          "position": "LM",
          "x": 18,
          "y": 54
        },
        {
          "position": "DM",
          "x": 38,
          "y": 48
        },
        {
          "position": "DM",
          "x": 62,
          "y": 48
        },
        {
          "position": "RM",
          "x": 82,
          "y": 54
        },
        {
          "position": "ST",
          "x": 50,
          "y": 88
        }
      ]
    },
    {
      "code": "523_COUNTER",
      "positions": [
        {
          "position": "GK",
          "x": 50,
          "y": 8
        },
        {
          "position": "LWB",
          "x": 12,
          "y": 36
        },
        {
          "position": "CB",
          "x": 30,
          "y": 22
        },
        {
          "position": "CB",
          "x": 50,
          "y": 20
        },
        {
          "position": "CB",
          "x": 70,
          "y": 22
        },
        {
          "position": "RWB",
          "x": 88,
          "y": 36
        },
        {
          "position": "CM",
          "x": 38,
          "y": 52
        },
        {
          "position": "CM",
          "x": 62,
          "y": 52
        },
        {
          "position": "LW",
          "x": 18,
          "y": 80
        },
        {
          "position": "ST",
          "x": 50,
          "y": 88
        },
        {
          "position": "RW",
          "x": 82,
          "y": 80
        }
      ]
    }
  ],
  "formationPairs": [
    {
      "a": "433_ATT",
      "b": "433_DEF",
      "winner": "433_DEF",
      "disadvantaged": "433_ATT",
      "basePenalty": 0.04,
      "affectedAxes": [
        "SHIELD"
      ],
      "mitigationIds": [
        "M04",
        "M07"
      ]
    },
    {
      "a": "433_ATT",
      "b": "4231_MOD",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "433_ATT",
      "b": "4231_WIDE",
      "winner": "4231_WIDE",
      "disadvantaged": "433_ATT",
      "basePenalty": 0.04,
      "affectedAxes": [
        "SHIELD"
      ],
      "mitigationIds": [
        "M04",
        "M07"
      ]
    },
    {
      "a": "433_ATT",
      "b": "442_CLASS",
      "winner": "433_ATT",
      "disadvantaged": "442_CLASS",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE"
      ],
      "mitigationIds": [
        "M01",
        "M05"
      ]
    },
    {
      "a": "433_ATT",
      "b": "41212_NAR",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "433_ATT",
      "b": "41212_WIDE",
      "winner": "433_ATT",
      "disadvantaged": "41212_WIDE",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE"
      ],
      "mitigationIds": [
        "M01",
        "M05"
      ]
    },
    {
      "a": "433_ATT",
      "b": "4312_NARROW",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "433_ATT",
      "b": "4321_TREE",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "433_ATT",
      "b": "352_WB",
      "winner": "433_ATT",
      "disadvantaged": "352_WB",
      "basePenalty": 0.04,
      "affectedAxes": [
        "WIDE"
      ],
      "mitigationIds": [
        "M03",
        "M06"
      ]
    },
    {
      "a": "433_ATT",
      "b": "343_FLAT",
      "winner": "433_ATT",
      "disadvantaged": "343_FLAT",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE"
      ],
      "mitigationIds": [
        "M01",
        "M05"
      ]
    },
    {
      "a": "433_ATT",
      "b": "3421_XABI",
      "winner": "3421_XABI",
      "disadvantaged": "433_ATT",
      "basePenalty": 0.04,
      "affectedAxes": [
        "BETWEEN_LINES",
        "BOX"
      ],
      "mitigationIds": [
        "M02",
        "M03",
        "M04",
        "M07"
      ]
    },
    {
      "a": "433_ATT",
      "b": "3412_CLASS",
      "winner": "433_ATT",
      "disadvantaged": "3412_CLASS",
      "basePenalty": 0.08,
      "affectedAxes": [
        "CENTRE",
        "WIDE"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M03",
        "M06"
      ]
    },
    {
      "a": "433_ATT",
      "b": "532_CATENACCIO",
      "winner": "433_ATT",
      "disadvantaged": "532_CATENACCIO",
      "basePenalty": 0.04,
      "affectedAxes": [
        "WIDE"
      ],
      "mitigationIds": [
        "M03",
        "M06"
      ]
    },
    {
      "a": "433_ATT",
      "b": "541_BUS",
      "winner": "433_ATT",
      "disadvantaged": "541_BUS",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE",
        "OUTLET"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M10"
      ]
    },
    {
      "a": "433_ATT",
      "b": "523_COUNTER",
      "winner": "433_ATT",
      "disadvantaged": "523_COUNTER",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE"
      ],
      "mitigationIds": [
        "M01",
        "M05"
      ]
    },
    {
      "a": "433_DEF",
      "b": "4231_MOD",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "433_DEF",
      "b": "4231_WIDE",
      "winner": "4231_WIDE",
      "disadvantaged": "433_DEF",
      "basePenalty": 0.08,
      "affectedAxes": [
        "SHIELD"
      ],
      "mitigationIds": [
        "M04",
        "M07"
      ]
    },
    {
      "a": "433_DEF",
      "b": "442_CLASS",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "433_DEF",
      "b": "41212_NAR",
      "winner": "41212_NAR",
      "disadvantaged": "433_DEF",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE",
        "BOX"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M02",
        "M06"
      ]
    },
    {
      "a": "433_DEF",
      "b": "41212_WIDE",
      "winner": "433_DEF",
      "disadvantaged": "41212_WIDE",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE"
      ],
      "mitigationIds": [
        "M01",
        "M05"
      ]
    },
    {
      "a": "433_DEF",
      "b": "4312_NARROW",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "433_DEF",
      "b": "4321_TREE",
      "winner": "4321_TREE",
      "disadvantaged": "433_DEF",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE"
      ],
      "mitigationIds": [
        "M01",
        "M05"
      ]
    },
    {
      "a": "433_DEF",
      "b": "352_WB",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "433_DEF",
      "b": "343_FLAT",
      "winner": "433_DEF",
      "disadvantaged": "343_FLAT",
      "basePenalty": 0.08,
      "affectedAxes": [
        "BETWEEN_LINES",
        "SHIELD"
      ],
      "mitigationIds": [
        "M02",
        "M09",
        "M04",
        "M07"
      ]
    },
    {
      "a": "433_DEF",
      "b": "3421_XABI",
      "winner": "433_DEF",
      "disadvantaged": "3421_XABI",
      "basePenalty": 0.04,
      "affectedAxes": [
        "WIDE",
        "BETWEEN_LINES"
      ],
      "mitigationIds": [
        "M03",
        "M06",
        "M02",
        "M09"
      ]
    },
    {
      "a": "433_DEF",
      "b": "3412_CLASS",
      "winner": "433_DEF",
      "disadvantaged": "3412_CLASS",
      "basePenalty": 0.04,
      "affectedAxes": [
        "WIDE",
        "BETWEEN_LINES"
      ],
      "mitigationIds": [
        "M03",
        "M06",
        "M02",
        "M09"
      ]
    },
    {
      "a": "433_DEF",
      "b": "532_CATENACCIO",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "433_DEF",
      "b": "541_BUS",
      "winner": "541_BUS",
      "disadvantaged": "433_DEF",
      "basePenalty": 0.04,
      "affectedAxes": [
        "BOX",
        "SHIELD"
      ],
      "mitigationIds": [
        "M04",
        "M07"
      ]
    },
    {
      "a": "433_DEF",
      "b": "523_COUNTER",
      "winner": "433_DEF",
      "disadvantaged": "523_COUNTER",
      "basePenalty": 0.08,
      "affectedAxes": [
        "BETWEEN_LINES",
        "SHIELD"
      ],
      "mitigationIds": [
        "M02",
        "M09",
        "M04",
        "M07"
      ]
    },
    {
      "a": "4231_MOD",
      "b": "4231_WIDE",
      "winner": "4231_WIDE",
      "disadvantaged": "4231_MOD",
      "basePenalty": 0.04,
      "affectedAxes": [
        "WIDE"
      ],
      "mitigationIds": [
        "M03",
        "M09"
      ]
    },
    {
      "a": "4231_MOD",
      "b": "442_CLASS",
      "winner": "442_CLASS",
      "disadvantaged": "4231_MOD",
      "basePenalty": 0.04,
      "affectedAxes": [
        "WIDE",
        "BOX"
      ],
      "mitigationIds": [
        "M03",
        "M09",
        "M02",
        "M06"
      ]
    },
    {
      "a": "4231_MOD",
      "b": "41212_NAR",
      "winner": "41212_NAR",
      "disadvantaged": "4231_MOD",
      "basePenalty": 0.08,
      "affectedAxes": [
        "CENTRE",
        "BOX"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M02",
        "M06"
      ]
    },
    {
      "a": "4231_MOD",
      "b": "41212_WIDE",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "4231_MOD",
      "b": "4312_NARROW",
      "winner": "4312_NARROW",
      "disadvantaged": "4231_MOD",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE",
        "BOX"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M02",
        "M06"
      ]
    },
    {
      "a": "4231_MOD",
      "b": "4321_TREE",
      "winner": "4321_TREE",
      "disadvantaged": "4231_MOD",
      "basePenalty": 0.08,
      "affectedAxes": [
        "CENTRE"
      ],
      "mitigationIds": [
        "M01",
        "M05"
      ]
    },
    {
      "a": "4231_MOD",
      "b": "352_WB",
      "winner": "352_WB",
      "disadvantaged": "4231_MOD",
      "basePenalty": 0.04,
      "affectedAxes": [
        "BOX"
      ],
      "mitigationIds": [
        "M04",
        "M07"
      ]
    },
    {
      "a": "4231_MOD",
      "b": "343_FLAT",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "4231_MOD",
      "b": "3421_XABI",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "4231_MOD",
      "b": "3412_CLASS",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "4231_MOD",
      "b": "532_CATENACCIO",
      "winner": "532_CATENACCIO",
      "disadvantaged": "4231_MOD",
      "basePenalty": 0.04,
      "affectedAxes": [
        "BOX"
      ],
      "mitigationIds": [
        "M04",
        "M07"
      ]
    },
    {
      "a": "4231_MOD",
      "b": "541_BUS",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "4231_MOD",
      "b": "523_COUNTER",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "4231_WIDE",
      "b": "442_CLASS",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "4231_WIDE",
      "b": "41212_NAR",
      "winner": "41212_NAR",
      "disadvantaged": "4231_WIDE",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE",
        "BOX"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M02",
        "M06"
      ]
    },
    {
      "a": "4231_WIDE",
      "b": "41212_WIDE",
      "winner": "4231_WIDE",
      "disadvantaged": "41212_WIDE",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE"
      ],
      "mitigationIds": [
        "M01",
        "M05"
      ]
    },
    {
      "a": "4231_WIDE",
      "b": "4312_NARROW",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "4231_WIDE",
      "b": "4321_TREE",
      "winner": "4321_TREE",
      "disadvantaged": "4231_WIDE",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE"
      ],
      "mitigationIds": [
        "M01",
        "M05"
      ]
    },
    {
      "a": "4231_WIDE",
      "b": "352_WB",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "4231_WIDE",
      "b": "343_FLAT",
      "winner": "4231_WIDE",
      "disadvantaged": "343_FLAT",
      "basePenalty": 0.08,
      "affectedAxes": [
        "BETWEEN_LINES",
        "SHIELD"
      ],
      "mitigationIds": [
        "M02",
        "M09",
        "M04",
        "M07"
      ]
    },
    {
      "a": "4231_WIDE",
      "b": "3421_XABI",
      "winner": "4231_WIDE",
      "disadvantaged": "3421_XABI",
      "basePenalty": 0.04,
      "affectedAxes": [
        "WIDE",
        "BETWEEN_LINES"
      ],
      "mitigationIds": [
        "M03",
        "M06",
        "M02",
        "M09"
      ]
    },
    {
      "a": "4231_WIDE",
      "b": "3412_CLASS",
      "winner": "4231_WIDE",
      "disadvantaged": "3412_CLASS",
      "basePenalty": 0.04,
      "affectedAxes": [
        "WIDE",
        "BETWEEN_LINES"
      ],
      "mitigationIds": [
        "M03",
        "M06",
        "M02",
        "M09"
      ]
    },
    {
      "a": "4231_WIDE",
      "b": "532_CATENACCIO",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "4231_WIDE",
      "b": "541_BUS",
      "winner": "541_BUS",
      "disadvantaged": "4231_WIDE",
      "basePenalty": 0.04,
      "affectedAxes": [
        "BOX"
      ],
      "mitigationIds": [
        "M04",
        "M07"
      ]
    },
    {
      "a": "4231_WIDE",
      "b": "523_COUNTER",
      "winner": "4231_WIDE",
      "disadvantaged": "523_COUNTER",
      "basePenalty": 0.08,
      "affectedAxes": [
        "BETWEEN_LINES",
        "SHIELD"
      ],
      "mitigationIds": [
        "M02",
        "M09",
        "M04",
        "M07"
      ]
    },
    {
      "a": "442_CLASS",
      "b": "41212_NAR",
      "winner": "41212_NAR",
      "disadvantaged": "442_CLASS",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE",
        "BETWEEN_LINES",
        "BOX"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M02",
        "M09",
        "M06"
      ]
    },
    {
      "a": "442_CLASS",
      "b": "41212_WIDE",
      "winner": "41212_WIDE",
      "disadvantaged": "442_CLASS",
      "basePenalty": 0.04,
      "affectedAxes": [
        "BETWEEN_LINES"
      ],
      "mitigationIds": [
        "M02",
        "M09"
      ]
    },
    {
      "a": "442_CLASS",
      "b": "4312_NARROW",
      "winner": "4312_NARROW",
      "disadvantaged": "442_CLASS",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE",
        "BETWEEN_LINES",
        "BOX"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M02",
        "M09",
        "M06"
      ]
    },
    {
      "a": "442_CLASS",
      "b": "4321_TREE",
      "winner": "4321_TREE",
      "disadvantaged": "442_CLASS",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE",
        "BETWEEN_LINES"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M02",
        "M09"
      ]
    },
    {
      "a": "442_CLASS",
      "b": "352_WB",
      "winner": "352_WB",
      "disadvantaged": "442_CLASS",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE",
        "BOX"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M02",
        "M06"
      ]
    },
    {
      "a": "442_CLASS",
      "b": "343_FLAT",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "442_CLASS",
      "b": "3421_XABI",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "442_CLASS",
      "b": "3412_CLASS",
      "winner": "3412_CLASS",
      "disadvantaged": "442_CLASS",
      "basePenalty": 0.04,
      "affectedAxes": [
        "BOX"
      ],
      "mitigationIds": [
        "M04",
        "M07"
      ]
    },
    {
      "a": "442_CLASS",
      "b": "532_CATENACCIO",
      "winner": "532_CATENACCIO",
      "disadvantaged": "442_CLASS",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE",
        "BOX"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M04",
        "M08"
      ]
    },
    {
      "a": "442_CLASS",
      "b": "541_BUS",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "442_CLASS",
      "b": "523_COUNTER",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "41212_NAR",
      "b": "41212_WIDE",
      "winner": "41212_NAR",
      "disadvantaged": "41212_WIDE",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE",
        "BOX"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M02",
        "M06"
      ]
    },
    {
      "a": "41212_NAR",
      "b": "4312_NARROW",
      "winner": "41212_NAR",
      "disadvantaged": "4312_NARROW",
      "basePenalty": 0.04,
      "affectedAxes": [
        "BETWEEN_LINES",
        "BOX"
      ],
      "mitigationIds": [
        "M02",
        "M09",
        "M06"
      ]
    },
    {
      "a": "41212_NAR",
      "b": "4321_TREE",
      "winner": "4321_TREE",
      "disadvantaged": "41212_NAR",
      "basePenalty": 0.04,
      "affectedAxes": [
        "BETWEEN_LINES"
      ],
      "mitigationIds": [
        "M02",
        "M03"
      ]
    },
    {
      "a": "41212_NAR",
      "b": "352_WB",
      "winner": "352_WB",
      "disadvantaged": "41212_NAR",
      "basePenalty": 0.04,
      "affectedAxes": [
        "BOX"
      ],
      "mitigationIds": [
        "M02",
        "M06"
      ]
    },
    {
      "a": "41212_NAR",
      "b": "343_FLAT",
      "winner": "41212_NAR",
      "disadvantaged": "343_FLAT",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE",
        "BETWEEN_LINES"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M02",
        "M09"
      ]
    },
    {
      "a": "41212_NAR",
      "b": "3421_XABI",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "41212_NAR",
      "b": "3412_CLASS",
      "winner": "41212_NAR",
      "disadvantaged": "3412_CLASS",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE",
        "BETWEEN_LINES"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M02",
        "M09"
      ]
    },
    {
      "a": "41212_NAR",
      "b": "532_CATENACCIO",
      "winner": "532_CATENACCIO",
      "disadvantaged": "41212_NAR",
      "basePenalty": 0.04,
      "affectedAxes": [
        "BOX"
      ],
      "mitigationIds": [
        "M04",
        "M08"
      ]
    },
    {
      "a": "41212_NAR",
      "b": "541_BUS",
      "winner": "41212_NAR",
      "disadvantaged": "541_BUS",
      "basePenalty": 0.12,
      "affectedAxes": [
        "CENTRE",
        "OUTLET"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M10"
      ]
    },
    {
      "a": "41212_NAR",
      "b": "523_COUNTER",
      "winner": "41212_NAR",
      "disadvantaged": "523_COUNTER",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE",
        "BETWEEN_LINES"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M02",
        "M09"
      ]
    },
    {
      "a": "41212_WIDE",
      "b": "4312_NARROW",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "41212_WIDE",
      "b": "4321_TREE",
      "winner": "4321_TREE",
      "disadvantaged": "41212_WIDE",
      "basePenalty": 0.08,
      "affectedAxes": [
        "CENTRE",
        "BETWEEN_LINES"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M02",
        "M03"
      ]
    },
    {
      "a": "41212_WIDE",
      "b": "352_WB",
      "winner": "352_WB",
      "disadvantaged": "41212_WIDE",
      "basePenalty": 0.08,
      "affectedAxes": [
        "CENTRE",
        "BOX"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M02",
        "M06"
      ]
    },
    {
      "a": "41212_WIDE",
      "b": "343_FLAT",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "41212_WIDE",
      "b": "3421_XABI",
      "winner": "3421_XABI",
      "disadvantaged": "41212_WIDE",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE",
        "BETWEEN_LINES"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M02",
        "M03"
      ]
    },
    {
      "a": "41212_WIDE",
      "b": "3412_CLASS",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "41212_WIDE",
      "b": "532_CATENACCIO",
      "winner": "532_CATENACCIO",
      "disadvantaged": "41212_WIDE",
      "basePenalty": 0.08,
      "affectedAxes": [
        "CENTRE",
        "BOX"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M04",
        "M08"
      ]
    },
    {
      "a": "41212_WIDE",
      "b": "541_BUS",
      "winner": "541_BUS",
      "disadvantaged": "41212_WIDE",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE"
      ],
      "mitigationIds": [
        "M01",
        "M05"
      ]
    },
    {
      "a": "41212_WIDE",
      "b": "523_COUNTER",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "4312_NARROW",
      "b": "4321_TREE",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "4312_NARROW",
      "b": "352_WB",
      "winner": "352_WB",
      "disadvantaged": "4312_NARROW",
      "basePenalty": 0.04,
      "affectedAxes": [
        "BOX"
      ],
      "mitigationIds": [
        "M02",
        "M06"
      ]
    },
    {
      "a": "4312_NARROW",
      "b": "343_FLAT",
      "winner": "4312_NARROW",
      "disadvantaged": "343_FLAT",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE",
        "BETWEEN_LINES"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M02",
        "M09"
      ]
    },
    {
      "a": "4312_NARROW",
      "b": "3421_XABI",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "4312_NARROW",
      "b": "3412_CLASS",
      "winner": "4312_NARROW",
      "disadvantaged": "3412_CLASS",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE",
        "BETWEEN_LINES"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M02",
        "M09"
      ]
    },
    {
      "a": "4312_NARROW",
      "b": "532_CATENACCIO",
      "winner": "532_CATENACCIO",
      "disadvantaged": "4312_NARROW",
      "basePenalty": 0.04,
      "affectedAxes": [
        "BOX"
      ],
      "mitigationIds": [
        "M04",
        "M08"
      ]
    },
    {
      "a": "4312_NARROW",
      "b": "541_BUS",
      "winner": "4312_NARROW",
      "disadvantaged": "541_BUS",
      "basePenalty": 0.12,
      "affectedAxes": [
        "CENTRE",
        "OUTLET"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M10"
      ]
    },
    {
      "a": "4312_NARROW",
      "b": "523_COUNTER",
      "winner": "4312_NARROW",
      "disadvantaged": "523_COUNTER",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE",
        "BETWEEN_LINES"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M02",
        "M09"
      ]
    },
    {
      "a": "4321_TREE",
      "b": "352_WB",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "4321_TREE",
      "b": "343_FLAT",
      "winner": "343_FLAT",
      "disadvantaged": "4321_TREE",
      "basePenalty": 0.04,
      "affectedAxes": [
        "WIDE"
      ],
      "mitigationIds": [
        "M03",
        "M09"
      ]
    },
    {
      "a": "4321_TREE",
      "b": "3421_XABI",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "4321_TREE",
      "b": "3412_CLASS",
      "winner": "4321_TREE",
      "disadvantaged": "3412_CLASS",
      "basePenalty": 0.12,
      "affectedAxes": [
        "CENTRE",
        "BETWEEN_LINES"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M02",
        "M09"
      ]
    },
    {
      "a": "4321_TREE",
      "b": "532_CATENACCIO",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "4321_TREE",
      "b": "541_BUS",
      "winner": "4321_TREE",
      "disadvantaged": "541_BUS",
      "basePenalty": 0.08,
      "affectedAxes": [
        "CENTRE",
        "OUTLET"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M10"
      ]
    },
    {
      "a": "4321_TREE",
      "b": "523_COUNTER",
      "winner": "523_COUNTER",
      "disadvantaged": "4321_TREE",
      "basePenalty": 0.04,
      "affectedAxes": [
        "WIDE"
      ],
      "mitigationIds": [
        "M03",
        "M09"
      ]
    },
    {
      "a": "352_WB",
      "b": "343_FLAT",
      "winner": "352_WB",
      "disadvantaged": "343_FLAT",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE",
        "BOX"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M04",
        "M07"
      ]
    },
    {
      "a": "352_WB",
      "b": "3421_XABI",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "352_WB",
      "b": "3412_CLASS",
      "winner": "352_WB",
      "disadvantaged": "3412_CLASS",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE"
      ],
      "mitigationIds": [
        "M01",
        "M05"
      ]
    },
    {
      "a": "352_WB",
      "b": "532_CATENACCIO",
      "winner": "532_CATENACCIO",
      "disadvantaged": "352_WB",
      "basePenalty": 0.04,
      "affectedAxes": [
        "BOX"
      ],
      "mitigationIds": [
        "M04",
        "M08"
      ]
    },
    {
      "a": "352_WB",
      "b": "541_BUS",
      "winner": "352_WB",
      "disadvantaged": "541_BUS",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE",
        "BOX"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M04",
        "M07"
      ]
    },
    {
      "a": "352_WB",
      "b": "523_COUNTER",
      "winner": "352_WB",
      "disadvantaged": "523_COUNTER",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE",
        "BOX"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M04",
        "M07"
      ]
    },
    {
      "a": "343_FLAT",
      "b": "3421_XABI",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "343_FLAT",
      "b": "3412_CLASS",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "343_FLAT",
      "b": "532_CATENACCIO",
      "winner": "532_CATENACCIO",
      "disadvantaged": "343_FLAT",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE",
        "BOX"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M04",
        "M07"
      ]
    },
    {
      "a": "343_FLAT",
      "b": "541_BUS",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "343_FLAT",
      "b": "523_COUNTER",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "3421_XABI",
      "b": "3412_CLASS",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "3421_XABI",
      "b": "532_CATENACCIO",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "3421_XABI",
      "b": "541_BUS",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "3421_XABI",
      "b": "523_COUNTER",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "3412_CLASS",
      "b": "532_CATENACCIO",
      "winner": "532_CATENACCIO",
      "disadvantaged": "3412_CLASS",
      "basePenalty": 0.08,
      "affectedAxes": [
        "CENTRE",
        "BOX"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M04",
        "M08"
      ]
    },
    {
      "a": "3412_CLASS",
      "b": "541_BUS",
      "winner": "3412_CLASS",
      "disadvantaged": "541_BUS",
      "basePenalty": 0.04,
      "affectedAxes": [
        "BOX",
        "OUTLET"
      ],
      "mitigationIds": [
        "M04",
        "M07",
        "M05",
        "M10"
      ]
    },
    {
      "a": "3412_CLASS",
      "b": "523_COUNTER",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    },
    {
      "a": "532_CATENACCIO",
      "b": "541_BUS",
      "winner": "532_CATENACCIO",
      "disadvantaged": "541_BUS",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE",
        "BOX"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M04",
        "M07"
      ]
    },
    {
      "a": "532_CATENACCIO",
      "b": "523_COUNTER",
      "winner": "532_CATENACCIO",
      "disadvantaged": "523_COUNTER",
      "basePenalty": 0.04,
      "affectedAxes": [
        "CENTRE",
        "BOX"
      ],
      "mitigationIds": [
        "M01",
        "M05",
        "M04",
        "M07"
      ]
    },
    {
      "a": "541_BUS",
      "b": "523_COUNTER",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "affectedAxes": [],
      "mitigationIds": []
    }
  ],
  "styles": [
    {
      "code": "BALANCED",
      "preset": {
        "mentality": "BALANCED",
        "tempo": 55,
        "passingStyle": "MIXED",
        "pressing": 55,
        "line": 50
      }
    },
    {
      "code": "CONTROL_POSSESSION",
      "preset": {
        "mentality": "BALANCED",
        "tempo": 45,
        "passingStyle": "SHORT",
        "pressing": 55,
        "line": 50
      }
    },
    {
      "code": "COUNTER_ATTACK",
      "preset": {
        "mentality": "CAUTIOUS",
        "tempo": 70,
        "passingStyle": "DIRECT",
        "pressing": 40,
        "line": 35
      }
    },
    {
      "code": "DIRECT_ATTACK",
      "preset": {
        "mentality": "ATTACKING",
        "tempo": 75,
        "passingStyle": "LONG",
        "pressing": 45,
        "line": 50
      }
    },
    {
      "code": "FLUID_COUNTER",
      "preset": {
        "mentality": "BALANCED",
        "tempo": 70,
        "passingStyle": "MIXED",
        "pressing": 45,
        "line": 40
      }
    },
    {
      "code": "GEGENPRESSING",
      "preset": {
        "mentality": "ATTACKING",
        "tempo": 75,
        "passingStyle": "MIXED",
        "pressing": 80,
        "line": 70
      }
    },
    {
      "code": "PARK_THE_BUS",
      "preset": {
        "mentality": "DEFENSIVE",
        "tempo": 30,
        "passingStyle": "MIXED",
        "pressing": 20,
        "line": 20
      }
    },
    {
      "code": "TIKI_TAKA",
      "preset": {
        "mentality": "ATTACKING",
        "tempo": 55,
        "passingStyle": "SHORT",
        "pressing": 55,
        "line": 50
      }
    },
    {
      "code": "VERTICAL_TIKI_TAKA",
      "preset": {
        "mentality": "ATTACKING",
        "tempo": 75,
        "passingStyle": "SHORT",
        "pressing": 65,
        "line": 60
      }
    },
    {
      "code": "WING_PLAY",
      "preset": {
        "mentality": "ATTACKING",
        "tempo": 65,
        "passingStyle": "MIXED",
        "pressing": 55,
        "line": 50
      }
    }
  ],
  "stylePairs": [
    {
      "a": "BALANCED",
      "b": "CONTROL_POSSESSION",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "mitigationIds": [],
      "reason": "Không áp bên bị khắc nền riêng; dùng nhánh setting và rule sơ đồ."
    },
    {
      "a": "BALANCED",
      "b": "COUNTER_ATTACK",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "mitigationIds": [],
      "reason": "Không áp bên bị khắc nền riêng; dùng nhánh setting và rule sơ đồ."
    },
    {
      "a": "BALANCED",
      "b": "DIRECT_ATTACK",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "mitigationIds": [],
      "reason": "Không áp bên bị khắc nền riêng; dùng nhánh setting và rule sơ đồ."
    },
    {
      "a": "BALANCED",
      "b": "FLUID_COUNTER",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "mitigationIds": [],
      "reason": "Không áp bên bị khắc nền riêng; dùng nhánh setting và rule sơ đồ."
    },
    {
      "a": "BALANCED",
      "b": "GEGENPRESSING",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "mitigationIds": [],
      "reason": "Không áp bên bị khắc nền riêng; dùng nhánh setting và rule sơ đồ."
    },
    {
      "a": "BALANCED",
      "b": "PARK_THE_BUS",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "mitigationIds": [],
      "reason": "Không áp bên bị khắc nền riêng; dùng nhánh setting và rule sơ đồ."
    },
    {
      "a": "BALANCED",
      "b": "TIKI_TAKA",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "mitigationIds": [],
      "reason": "Không áp bên bị khắc nền riêng; dùng nhánh setting và rule sơ đồ."
    },
    {
      "a": "BALANCED",
      "b": "VERTICAL_TIKI_TAKA",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "mitigationIds": [],
      "reason": "Không áp bên bị khắc nền riêng; dùng nhánh setting và rule sơ đồ."
    },
    {
      "a": "BALANCED",
      "b": "WING_PLAY",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "mitigationIds": [],
      "reason": "Không áp bên bị khắc nền riêng; dùng nhánh setting và rule sơ đồ."
    },
    {
      "a": "CONTROL_POSSESSION",
      "b": "COUNTER_ATTACK",
      "winner": "COUNTER_ATTACK",
      "disadvantaged": "CONTROL_POSSESSION",
      "basePenalty": 0.04,
      "mitigationIds": [
        "M06"
      ],
      "reason": "Đi nhanh khi đối thủ dâng/luân chuyển; phải có khoảng trống và điểm nhận thật."
    },
    {
      "a": "CONTROL_POSSESSION",
      "b": "DIRECT_ATTACK",
      "winner": "CONTROL_POSSESSION",
      "disadvantaged": "DIRECT_ATTACK",
      "basePenalty": 0.04,
      "mitigationIds": [
        "M10"
      ],
      "reason": "Duy trì/đưa bóng qua vùng đích trước khối ít lối ra; cần quyết định đúng và kiên nhẫn."
    },
    {
      "a": "CONTROL_POSSESSION",
      "b": "FLUID_COUNTER",
      "winner": "FLUID_COUNTER",
      "disadvantaged": "CONTROL_POSSESSION",
      "basePenalty": 0.04,
      "mitigationIds": [
        "M06"
      ],
      "reason": "Đi nhanh khi đối thủ dâng/luân chuyển; phải có khoảng trống và điểm nhận thật."
    },
    {
      "a": "CONTROL_POSSESSION",
      "b": "GEGENPRESSING",
      "winner": "GEGENPRESSING",
      "disadvantaged": "CONTROL_POSSESSION",
      "basePenalty": 0.08,
      "mitigationIds": [
        "M05"
      ],
      "reason": "Ép nhánh triển khai ngắn; bên bị ép cần đầu ra và kỹ thuật thoát pressing."
    },
    {
      "a": "CONTROL_POSSESSION",
      "b": "PARK_THE_BUS",
      "winner": "CONTROL_POSSESSION",
      "disadvantaged": "PARK_THE_BUS",
      "basePenalty": 0.04,
      "mitigationIds": [
        "M08"
      ],
      "reason": "Duy trì/đưa bóng qua vùng đích trước khối ít lối ra; cần quyết định đúng và kiên nhẫn."
    },
    {
      "a": "CONTROL_POSSESSION",
      "b": "TIKI_TAKA",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "mitigationIds": [],
      "reason": "Không áp bên bị khắc nền riêng; dùng nhánh setting và rule sơ đồ."
    },
    {
      "a": "CONTROL_POSSESSION",
      "b": "VERTICAL_TIKI_TAKA",
      "winner": "VERTICAL_TIKI_TAKA",
      "disadvantaged": "CONTROL_POSSESSION",
      "basePenalty": 0.04,
      "mitigationIds": [
        "M02"
      ],
      "reason": "Duy trì/đưa bóng qua vùng đích trước khối ít lối ra; cần quyết định đúng và kiên nhẫn."
    },
    {
      "a": "CONTROL_POSSESSION",
      "b": "WING_PLAY",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "mitigationIds": [],
      "reason": "Không áp bên bị khắc nền riêng; dùng nhánh setting và rule sơ đồ."
    },
    {
      "a": "COUNTER_ATTACK",
      "b": "DIRECT_ATTACK",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "mitigationIds": [],
      "reason": "Không áp bên bị khắc nền riêng; dùng nhánh setting và rule sơ đồ."
    },
    {
      "a": "COUNTER_ATTACK",
      "b": "FLUID_COUNTER",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "mitigationIds": [],
      "reason": "Không áp bên bị khắc nền riêng; dùng nhánh setting và rule sơ đồ."
    },
    {
      "a": "COUNTER_ATTACK",
      "b": "GEGENPRESSING",
      "winner": "COUNTER_ATTACK",
      "disadvantaged": "GEGENPRESSING",
      "basePenalty": 0.08,
      "mitigationIds": [
        "M06"
      ],
      "reason": "Đi nhanh khi đối thủ dâng/luân chuyển; phải có khoảng trống và điểm nhận thật."
    },
    {
      "a": "COUNTER_ATTACK",
      "b": "PARK_THE_BUS",
      "winner": "PARK_THE_BUS",
      "disadvantaged": "COUNTER_ATTACK",
      "basePenalty": 0.08,
      "mitigationIds": [
        "M07"
      ],
      "reason": "Giảm không gian phản công/trực diện hoặc hấp thụ tạt bổng; bên bất lợi cần đổi hướng tạo cơ hội."
    },
    {
      "a": "COUNTER_ATTACK",
      "b": "TIKI_TAKA",
      "winner": "COUNTER_ATTACK",
      "disadvantaged": "TIKI_TAKA",
      "basePenalty": 0.04,
      "mitigationIds": [
        "M06"
      ],
      "reason": "Đi nhanh khi đối thủ dâng/luân chuyển; phải có khoảng trống và điểm nhận thật."
    },
    {
      "a": "COUNTER_ATTACK",
      "b": "VERTICAL_TIKI_TAKA",
      "winner": "COUNTER_ATTACK",
      "disadvantaged": "VERTICAL_TIKI_TAKA",
      "basePenalty": 0.04,
      "mitigationIds": [
        "M06"
      ],
      "reason": "Đi nhanh khi đối thủ dâng/luân chuyển; phải có khoảng trống và điểm nhận thật."
    },
    {
      "a": "COUNTER_ATTACK",
      "b": "WING_PLAY",
      "winner": "COUNTER_ATTACK",
      "disadvantaged": "WING_PLAY",
      "basePenalty": 0.04,
      "mitigationIds": [
        "M06"
      ],
      "reason": "Đi nhanh khi đối thủ dâng/luân chuyển; phải có khoảng trống và điểm nhận thật."
    },
    {
      "a": "DIRECT_ATTACK",
      "b": "FLUID_COUNTER",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "mitigationIds": [],
      "reason": "Không áp bên bị khắc nền riêng; dùng nhánh setting và rule sơ đồ."
    },
    {
      "a": "DIRECT_ATTACK",
      "b": "GEGENPRESSING",
      "winner": "DIRECT_ATTACK",
      "disadvantaged": "GEGENPRESSING",
      "basePenalty": 0.04,
      "mitigationIds": [
        "M06"
      ],
      "reason": "Đi nhanh khi đối thủ dâng/luân chuyển; phải có khoảng trống và điểm nhận thật."
    },
    {
      "a": "DIRECT_ATTACK",
      "b": "PARK_THE_BUS",
      "winner": "PARK_THE_BUS",
      "disadvantaged": "DIRECT_ATTACK",
      "basePenalty": 0.08,
      "mitigationIds": [
        "M08"
      ],
      "reason": "Giảm không gian phản công/trực diện hoặc hấp thụ tạt bổng; bên bất lợi cần đổi hướng tạo cơ hội."
    },
    {
      "a": "DIRECT_ATTACK",
      "b": "TIKI_TAKA",
      "winner": "TIKI_TAKA",
      "disadvantaged": "DIRECT_ATTACK",
      "basePenalty": 0.04,
      "mitigationIds": [
        "M10"
      ],
      "reason": "Duy trì/đưa bóng qua vùng đích trước khối ít lối ra; cần quyết định đúng và kiên nhẫn."
    },
    {
      "a": "DIRECT_ATTACK",
      "b": "VERTICAL_TIKI_TAKA",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "mitigationIds": [],
      "reason": "Không áp bên bị khắc nền riêng; dùng nhánh setting và rule sơ đồ."
    },
    {
      "a": "DIRECT_ATTACK",
      "b": "WING_PLAY",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "mitigationIds": [],
      "reason": "Không áp bên bị khắc nền riêng; dùng nhánh setting và rule sơ đồ."
    },
    {
      "a": "FLUID_COUNTER",
      "b": "GEGENPRESSING",
      "winner": "FLUID_COUNTER",
      "disadvantaged": "GEGENPRESSING",
      "basePenalty": 0.08,
      "mitigationIds": [
        "M06"
      ],
      "reason": "Đi nhanh khi đối thủ dâng/luân chuyển; phải có khoảng trống và điểm nhận thật."
    },
    {
      "a": "FLUID_COUNTER",
      "b": "PARK_THE_BUS",
      "winner": "PARK_THE_BUS",
      "disadvantaged": "FLUID_COUNTER",
      "basePenalty": 0.08,
      "mitigationIds": [
        "M07"
      ],
      "reason": "Giảm không gian phản công/trực diện hoặc hấp thụ tạt bổng; bên bất lợi cần đổi hướng tạo cơ hội."
    },
    {
      "a": "FLUID_COUNTER",
      "b": "TIKI_TAKA",
      "winner": "FLUID_COUNTER",
      "disadvantaged": "TIKI_TAKA",
      "basePenalty": 0.04,
      "mitigationIds": [
        "M06"
      ],
      "reason": "Đi nhanh khi đối thủ dâng/luân chuyển; phải có khoảng trống và điểm nhận thật."
    },
    {
      "a": "FLUID_COUNTER",
      "b": "VERTICAL_TIKI_TAKA",
      "winner": "FLUID_COUNTER",
      "disadvantaged": "VERTICAL_TIKI_TAKA",
      "basePenalty": 0.04,
      "mitigationIds": [
        "M06"
      ],
      "reason": "Đi nhanh khi đối thủ dâng/luân chuyển; phải có khoảng trống và điểm nhận thật."
    },
    {
      "a": "FLUID_COUNTER",
      "b": "WING_PLAY",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "mitigationIds": [],
      "reason": "Không áp bên bị khắc nền riêng; dùng nhánh setting và rule sơ đồ."
    },
    {
      "a": "GEGENPRESSING",
      "b": "PARK_THE_BUS",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "mitigationIds": [],
      "reason": "Không áp bên bị khắc nền riêng; dùng nhánh setting và rule sơ đồ."
    },
    {
      "a": "GEGENPRESSING",
      "b": "TIKI_TAKA",
      "winner": "GEGENPRESSING",
      "disadvantaged": "TIKI_TAKA",
      "basePenalty": 0.08,
      "mitigationIds": [
        "M05"
      ],
      "reason": "Ép nhánh triển khai ngắn; bên bị ép cần đầu ra và kỹ thuật thoát pressing."
    },
    {
      "a": "GEGENPRESSING",
      "b": "VERTICAL_TIKI_TAKA",
      "winner": "GEGENPRESSING",
      "disadvantaged": "VERTICAL_TIKI_TAKA",
      "basePenalty": 0.04,
      "mitigationIds": [
        "M05"
      ],
      "reason": "Ép nhánh triển khai ngắn; bên bị ép cần đầu ra và kỹ thuật thoát pressing."
    },
    {
      "a": "GEGENPRESSING",
      "b": "WING_PLAY",
      "winner": "WING_PLAY",
      "disadvantaged": "GEGENPRESSING",
      "basePenalty": 0.04,
      "mitigationIds": [
        "M03"
      ],
      "reason": "Đổi hướng ra rộng trước khối thiên giữa/pressing; cần người đón và bọc."
    },
    {
      "a": "PARK_THE_BUS",
      "b": "TIKI_TAKA",
      "winner": "TIKI_TAKA",
      "disadvantaged": "PARK_THE_BUS",
      "basePenalty": 0.04,
      "mitigationIds": [
        "M10"
      ],
      "reason": "Duy trì/đưa bóng qua vùng đích trước khối ít lối ra; cần quyết định đúng và kiên nhẫn."
    },
    {
      "a": "PARK_THE_BUS",
      "b": "VERTICAL_TIKI_TAKA",
      "winner": "VERTICAL_TIKI_TAKA",
      "disadvantaged": "PARK_THE_BUS",
      "basePenalty": 0.08,
      "mitigationIds": [
        "M02"
      ],
      "reason": "Duy trì/đưa bóng qua vùng đích trước khối ít lối ra; cần quyết định đúng và kiên nhẫn."
    },
    {
      "a": "PARK_THE_BUS",
      "b": "WING_PLAY",
      "winner": "PARK_THE_BUS",
      "disadvantaged": "WING_PLAY",
      "basePenalty": 0.04,
      "mitigationIds": [
        "M08"
      ],
      "reason": "Giảm không gian phản công/trực diện hoặc hấp thụ tạt bổng; bên bất lợi cần đổi hướng tạo cơ hội."
    },
    {
      "a": "TIKI_TAKA",
      "b": "VERTICAL_TIKI_TAKA",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "mitigationIds": [],
      "reason": "Không áp bên bị khắc nền riêng; dùng nhánh setting và rule sơ đồ."
    },
    {
      "a": "TIKI_TAKA",
      "b": "WING_PLAY",
      "winner": "WING_PLAY",
      "disadvantaged": "TIKI_TAKA",
      "basePenalty": 0.04,
      "mitigationIds": [
        "M03"
      ],
      "reason": "Đổi hướng ra rộng trước khối thiên giữa/pressing; cần người đón và bọc."
    },
    {
      "a": "VERTICAL_TIKI_TAKA",
      "b": "WING_PLAY",
      "winner": null,
      "disadvantaged": null,
      "basePenalty": 0,
      "mitigationIds": [],
      "reason": "Không áp bên bị khắc nền riêng; dùng nhánh setting và rule sơ đồ."
    }
  ],
  "instructions": [
    "COUNTER_PRESS",
    "DIRECT_COUNTER",
    "DISTRIBUTE_QUICKLY",
    "DROP_OFF_DEFENCE",
    "EXTREMELY_WIDE",
    "FORCE_INSIDE",
    "FORCE_OUTSIDE",
    "GET_STUCK_IN",
    "HIGH_PRESS_LINE",
    "HIGH_TEMPO_PLAY",
    "HIT_EARLY_CROSSES",
    "HOLD_SHAPE",
    "LOW_BLOCK_BUS",
    "LOW_TEMPO_CONTROL",
    "MID_BLOCK",
    "OFFSIDE_TRAP",
    "OVERLAP_WINGS",
    "PASS_INTO_SPACE",
    "PLAY_OUT_OF_DEFENCE",
    "QUICK_COUNTER",
    "REGROUP_DEFENCE",
    "SHOOT_ON_SIGHT",
    "SLOW_PACE_DOWN",
    "STAY_ON_FEET_DEF",
    "TIGHT_MAN_MARKING",
    "TIKI_TAKA_CONTROL",
    "UNDERLAP_WINGS",
    "VERTICAL_TIKI_TAKA",
    "WING_PLAY",
    "WORK_BALL_INTO_BOX"
  ],
  "roles": [
    "ADVANCED_FORWARD",
    "ADVANCED_PLAYMAKER",
    "ANCHOR_MAN",
    "ATTACKING_FULLBACK",
    "BALL_PLAYING_DEFENDER",
    "BALL_WINNING_MIDFIELDER",
    "BOX_TO_BOX",
    "COMMANDING_KEEPER",
    "COMPLETE_WINGBACK",
    "DEEP_LYING_PLAYMAKER",
    "FALSE_NINE",
    "INVERTED_WINGER",
    "MEZZALA",
    "NO_NONSENSE_CB",
    "POACHER",
    "PRESSING_FORWARD",
    "SHADOW_STRIKER",
    "SHOT_STOPPER",
    "SWEEPER_KEEPER",
    "SWEEPER_LIBERO",
    "TARGET_MAN",
    "TRADITIONAL_WINGER",
    "WIDE_PLAYMAKER"
  ],
  "hash": "734b5800a6f589cb89fc4a455304d18e133aefa04bea88005e5cfec6872af611"
};
