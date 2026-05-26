/* js/data.js — 預設模板資料 (source: default.json v2.2)
 *
 * v2.2 結構：locations_list / type_list 為全域常數，不存於 profile 內
 * 修正：liver& → liver；barin → brain；tendi location 錯誤；djd1 重複；active 型別
 */
/* global DEFAULT_TEMPLATE_DATA, DEFAULT_LOCATIONS_LIST, DEFAULT_TYPE_LIST */

/** 全域身體部位清單 */
const DEFAULT_LOCATIONS_LIST = [
  "brain", "nasopharynx", "oral", "neck", "sinus", "tongue", "larynx", "tonsil",
  "thyroid", "lung", "mediastinum", "chest", "axilla", "breast",
  "liver", "abdominal cavity", "pancreas", "stomach", "kidney", "spleen", "adrenal",
  "bowel", "uterus&bo", "bladder", "prostate", "bone"
];

/** 全域病灶型態清單 */
const DEFAULT_TYPE_LIST = [
  "soft-tissue", "nodule", "lymph node", "inf&phy", "muscle", "malignant", "Abb"
];

/** 預設 profile 模板資料 */
const DEFAULT_TEMPLATE_DATA = {
  version: "2.2",
  category_list: [
    "Common", "Brain", "Head&Neck", "Lung", "Chest",
    "Abdomen", "Pelvic", "Others", "WholeBody",
    "FollowUp", "Abbreviation", "Cancer"
  ],
  category: {

    /* ────────── Common ────────── */
    "Common": [
      {
        shortcut: "lesion", active: true, location: [], type: ["Abb"],
        description: "simple lesion with measuring",
        main: "V{+nodule|lymph node|mass|lesion} with V{+mild increased|increased|intense} FDG uptake V{+|(size:LE[]cm, maxSUV:LE[])|(size:LE[]xLE[]cm, maxSUV:LE[])} in the"
      },
      {
        shortcut: "fdg", active: true, location: [], type: ["Abb"],
        description: "simple FDG uptake lesion",
        main: "V{Focal|Diffuse|Heterogenerous|Nodular} V{+faint|mild increased|moderate increased|intense} FDG uptake in the"
      },
      {
        shortcut: "preexist", active: true, location: [], type: ["Abb"],
        description: "pre-existing hypermetabolic lesion",
        main: "The pre-existing hypermetabolic lesion in the"
      },
      {
        shortcut: "nomet", active: true, location: [], type: ["Abb"],
        description: "no metastasis",
        main: "No obvious abnormal FDG uptake lesion is noted to suggest regional nodal or distant metastasis."
      },
      {
        shortcut: "brownfat", active: true, location: [], type: ["inf&phy"],
        description: "brown fat metabolism",
        main: "Diffuse mild increased FDG uptake in bilateral G2{occipital|cervical|supraclavicular|paravertebral|mediastinal|para-aortic|suprarenal} adipose tissue is likely due to physiologic change of brown adipose tissue."
      },
      {
        shortcut: "m", active: true, location: [], type: ["Abb"],
        description: "regular measuring",
        main: "V{(LE[]cm)|(LE[]cm, IMA:LE[])|(LE[]cm, maxSUV:LE[])|(LE[]xLE[]cm, maxSUV:LE[])|(LE[]xLE[]xLE[]cm, maxSUV:LE[])}"
      },
      {
        shortcut: "ctf", active: true, location: [], type: ["Abb"],
        description: "CT findings prefix",
        main: "CT shows "
      },
      {
        shortcut: "conc", active: true, location: [], type: ["Abb"],
        description: "CT shows + 分隔線",
        main: "\n\n\nCT shows \nCONCLUSIONS-----------------------------\n\n\n"
      },
      {
        shortcut: "conc1", active: true, location: [], type: ["Abb"],
        description: "CT shows + 分隔線 + normal brain",
        main: "\n\n\nCT shows \nCONCLUSIONS-----------------------------\nNormal physiological FDG-PET study of the brain."
      }
    ],

    /* ────────── Brain ────────── */
    "Brain": [
      {
        shortcut: "brainmet", active: true, location: ["brain"], type: ["malignant"],
        description: "Brain metastasis",
        main: "V{Focal|Nodular} increased FDG uptake in the M{H[right|bilateral|left] frontal|H[right|bilateral|left] temporal|H[right|bilateral|left] parietal|H[right|bilateral|left] occipital|H[right|bilateral|left] cerebellum} lobe(s). Brain metastasis should be suspected."
      },
      {
        shortcut: "oldcva", active: true, location: ["brain"], type: [],
        description: "Old CVA of brain",
        main: "Focal decreased FDG uptake in M{H[right|bilateral|left] frontal|H[right|bilateral|left] temporal|H[right|bilateral|left] parietal|H[right|bilateral|left] occipital} lobe(s), possibly due to old post-CVA change."
      },
      {
        shortcut: "dementia", active: true, location: ["brain"], type: [],
        description: "suspicious of dementia",
        main: "Focal H{increased|+decreased} FDG uptake in the M{H[right|bilateral|left] frontal lobe|H[right|bilateral|left] temporal lobe|H[right|bilateral|left] parietal lobe|H[right|bilateral|left] occipital lobe|H[right|bilateral|left] limbic system|H[right|bilateral|left] posterior cingulate cortex}"
      },
      {
        shortcut: "puiti", active: true, location: ["brain"], type: [],
        description: "pituitary adenoma",
        main: "One small focus of nodular increased FDG uptake in the sella turcica, r/o pituitary adenoma. "
      }
    ],

    /* ────────── Head&Neck ────────── */
    "Head&Neck": [
      {
        shortcut: "na", active: true, location: ["nasopharynx"], type: [],
        description: "nasopharynx adenoid/reactive hyperplasia",
        main: "V{Mild|+Mild increased|Increased} FDG uptake in the M{nasopharyngeal adenoid|H[right|+bilateral|left] nasopharynx+} V{+|without abnormal in shape}, likely due to V{+reactive hyperplasia| mild inflammation}. C{Possible block[3] in block[2] nasopharynx.|Suggest ENT OPD follow up}\n"
      },
      {
        shortcut: "na-asymme", active: true, location: ["nasopharynx"], type: [],
        description: "Asymmetric nasopharynx FDG uptake",
        main: "Asymmetrically increased FDG uptake in the M{H[right|left] nasopharynx|H[right|bilateral|left] tonsil} V{|, +without structural abnormality shown on CT}, possibly due to V{reactive hyperplasia|+mild inflammation} V{+|but tumoral uptake cannot be ruled out}. C{Possible block[3] in block[1] nasopharynx.|Suggest ENT OPD further examination}"
      },
      {
        shortcut: "vocalcord", active: true, location: ["larynx"], type: [],
        description: "vocal cord physiologic/inflammation",
        main: "V{Symmetrical|Asymmetrical} increased FDG uptake in the H{right|bilateral|left} vocal cord V{+|without abnormality in CT image}, possible due to V{+pronouncing-related physiologic change|mild inflammation}."
      },
      {
        shortcut: "neckln", active: true, location: ["neck"], type: ["lymph node"],
        description: "neck lymph nodes lymphadenitis",
        main: "V{Mild|+Mild increased|Increased} FDG uptake in H{the right|+bilateral|the left} V{+upper neck|lower neck|submandibular region|parotic region} small lymph nodes, likely due to lymphadenitis. C{Possible non-specific lymphadenitis in block[2] neck region.}"
      },
      {
        shortcut: "dental", active: true, location: ["oral"], type: ["inf&phy"],
        description: "dental uptake",
        main: "Focal V{+mild increased|increased} FDG uptake in G3{blank|the upper anterior|blank|the right upper|bilateral upper|the left upper|the right lower|bilateral lower|the left lower|blank|the lower anterior|blank} dental bed(s), possibly due to V{dental implant|dentopathy+}.\nC{Possible block[2] block[3].|Suggest dentist OPD follow up, if symptomatic.}"
      },
      {
        shortcut: "sinus", active: true, location: ["sinus"], type: ["inf&phy"],
        description: "sinusitis",
        main: "Mucus accumulation V{|+with faint FDG uptake} in the M{H[right|bilateral|left] maxillary|H[right|bilateral|left] ethmoid|H[right|bilateral|left] sphenoid} sinus, likely due to sinusitis."
      },
      {
        shortcut: "com", active: true, location: [], type: ["inf&phy"],
        description: "chronic otitis media",
        main: "Decreased pneumonization of H{the right|+bilateral|the left} mastoid air cells V{|+with faint FDG uptake}, r/o chronic otitis media."
      },
      {
        shortcut: "mng", active: true, location: ["thyroid"], type: [],
        description: "multinodular goiter",
        main: "V{+Heterogeneous nodularities|Hypodense nodules} with V{faint| diffusely mild|heterogeneously mild} FDG uptake H{|and calcification spots} in bilateral thyroid lobes, possibly due to multinodular goiter."
      },
      {
        shortcut: "thyroidnd", active: true, location: ["thyroid"], type: [],
        description: "thyroid nodule",
        main: "A V{+hypodense|} nodule V{|+with mild FDG uptake|with increased FDG uptake|with intense FDG uptake} in H{the right|the left} thyroid lobe."
      },
      {
        shortcut: "ts", active: true, location: ["thyroid"], type: ["inf&phy"],
        description: "chronic thyroiditis / physiological thyroid uptake",
        main: "Diffusely V{faint|+mild|mildly increased|increased} FDG uptake in bilateral thyroid lobes, possibly due to V{+chronic thyroiditis|physiological uptake|chronic thyroiditis or physiological uptake}."
      },
      {
        shortcut: "neckmuscle", active: true, location: ["neck"], type: ["inf&phy"],
        description: "neck muscle physiologic uptake",
        main: "Linear increased FDG uptake in the M/{H[right|bilateral|left] colli longus|H[right|bilateral|left] capitis longus|H[right|bilateral|left] pterygoid|H[right|bilateral|left] masticator|H[right|bilateral|left] pterygoid|H[right|bilateral|left] stylohyoideus|H[right|bilateral|left] digastric|H[right|bilateral|left] rectus capitis|H[right|bilateral|left] oblique capitis|H[right|bilateral|left] sternohyoideus |H[right|bilateral|left] scalene|H[right|bilateral|left] sternocleidomastoid} muscle(s), favoring muscle stress related physiologic change."
      },
      {
        shortcut: "cdjd", active: true, location: ["bone", "neck"], type: ["inf&phy"],
        description: "cervical facet joint degenerative arthritis",
        main: "Focal H{+mild|} increased FDG uptake in the M{H[right|bilateral|left] C1/C2|H[right|bilateral|left] C2/C3|H[right|bilateral|left] C3/C4|H[right|bilateral|left] C4/C5|H[right|bilateral|left] C5/C6 |H[right|bilateral|left] C6/C7|H[right|bilateral|left] C7/T1} V{facet joint(s)|junction(s)}, likely due to degenerative arthritis."
      },
      {
        shortcut: "cthead", active: true, location: ["neck"], type: [],
        description: "CT head incidental findings",
        main: "M{H[right|bilateral|left] maxillary|H[right|bilateral|left] ethmoid|H[right|bilateral|left] sphnoid|H[right|bilateral|left] frontal|H[right|bilateral|left] enlarged thyroid gland; } M{H[mild|] sinusitis+; |polyp; }"
      }
    ],

    /* ────────── Lung ────────── */
    "Lung": [
      {
        shortcut: "nln", active: true, location: ["lung"], type: ["lymph node"],
        description: "mediastinal / hilar lymphadenitis",
        main: "H{Mild|+Mild increased|Increased} FDG uptake in the M{mediastinal|H[right|bilateral|left] hilar} H{+|small|calcified} lymph nodes, likely due to lymphadenitis."
      },
      {
        shortcut: "nd", active: true, location: ["lung"], type: ["nodule"],
        description: "lung nodule with location & measuring",
        main: "V{|tiny nodule in the+} G2{right upper lung|left upper lung|right middle lung|left lower lung|right lower lung|blank}V{(LE[]cm)|(LE[]cm, image:LE[])|(LE[]cm, maxSUV:LE[])|(LE[]xLE[]cm, maxSUV:LE[])|(LE[]xLE[]xLE[]cm, maxSUV:LE[])}"
      },
      {
        shortcut: "lungnd", active: true, location: ["lung"], type: ["nodule"],
        description: "lung nodule with uptake & measuring",
        main: "M{H[solid|subsolid|calcified] nodule(s)|GGO lesion(s)|patch} V{with mild increased FDG uptake|with intense FDG uptake} in the G2{right upper lung|left upper lung|right middle lung|left lower lung|right lower lung|blank} V{(LE[]cm)|(LE[]cm, image:LE[])|(LE[]cm, maxSUV:LE[])|(LE[]xLE[]cm, maxSUV:LE[])|(LE[]xLE[]xLE[]cm, maxSUV:LE[])}"
      },
      {
        shortcut: "axillaryln", active: true, location: ["axilla"], type: ["lymph node"],
        description: "axillary lymphadenitis",
        main: "There is mildly increased FDG uptake in H{the right|+bilateral|the left} axillary small lymph nodes V{+|with fatty hilum}, favoring V{+lymphadenitis|reactive hyperplasia}."
      },
      {
        shortcut: "ctlungnd", active: true, location: ["lung"], type: ["nodule"],
        description: "CT lung nodule (no FDG uptake)",
        main: "H{+|tiny} V{calcified spot|nodule|patch|GGO lesion} in the G2{RUL|LUL|RML|LLL|RLL|blank}"
      },
      {
        shortcut: "lungm", active: true, location: ["lung"], type: ["nodule"],
        description: "lung lobar measuring",
        main: "G2{RUL|LUL|RML|LLL|RLL}V{(LE[]cm)|(LE[]cm, IMA:LE[])|(LE[]cm, maxSUV:LE[])|(LE[]xLE[]cm, maxSUV:LE[])|(LE[]xLE[]xLE[]cm, maxSUV:LE[])}"
      },
      {
        shortcut: "lunginf", active: true, location: ["lung"], type: ["inf&phy"],
        description: "lung inflammation",
        main: "H{+Focal|Diffuse} fibro-infiltration M{|+with H[faint increased|mild increased|intense] FDG uptake} in the G2{RUL|LUL|RML|LLL|RLL}"
      },
      {
        shortcut: "pleuraeffusion", active: true, location: ["lung"], type: [],
        description: "pleural effusion",
        main: "V{|Mild+|Moderate|Massive} H{right|+bilateral|left} pleural effusion V{+|with faint FDG uptake}"
      },
      {
        shortcut: "chestct", active: true, location: ["lung", "chest"], type: [],
        description: "CT chest/lung incidental findings",
        main: "m{coronary artery H[+|mild|severe] calcification; |H[|mild] emphysematous change of both lungs; |s/p H[right|bilateral|left] mastectomy; |fibrocystic change of bilateral breast; }"
      }
    ],

    /* ────────── Chest ────────── */
    "Chest": [
      {
        shortcut: "breast", active: true, location: ["breast"], type: ["nodule"],
        description: "breast nodule",
        main: "a nodule V{without abnormal FDG uptake|+with mild increased FDG uptake|with intense FDG uptake} in the G2{upper-outer quadrant of the right|upper-inner quadrant of the right|lower-outer quadrant of the right|lower-inner quadrant of the right|upper-inner quadrant of the left|upper-outer quadrant of the left|lower-inner quadrant of the left|lower-outer quadrant of the left} breast."
      },
      {
        shortcut: "antmed", active: true, location: ["chest"], type: [],
        description: "anterior mediastinum uptake",
        main: "Mild increased FDG uptake in anterior mediastinum, favoring ."
      },
      {
        shortcut: "eso", active: true, location: ["chest"], type: [],
        description: "esophageal lesion",
        main: "V{+Focal| Linearly| Segmentally} H{mild|+mildly increased|increased} FDG uptake in the V{+distal esophagus near EC junction|lower esophagus|EC junction| entire esophagus}, possibly due to V{+reflux esophagitis|mild inflammation|physiological uptake|post-RT change}."
      },
      {
        shortcut: "sterno", active: true, location: ["chest"], type: ["inf&phy"],
        description: "sternoclavicular junction degenerative change",
        main: "Focal V{+mildly increased|mild} FDG uptake in H{the right|the left|bilateral} sternoclavicular junction, likely due to degenerative change."
      },
      {
        shortcut: "tdjd", active: true, location: ["chest", "bone"], type: ["inf&phy"],
        description: "thoracic facet joint degenerative arthritis",
        main: "Focal H{+mild|} increased FDG uptake in the M{H[right|bilateral|left] T1/T2|H[right|bilateral|left] T2/T3|H[right|bilateral|left] T3/T4|H[right|bilateral|left] T4/T5|H[right|bilateral|left] T5/T6|H[right|bilateral|left] T6/T7|H[right|bilateral|left] T7/T8|H[right|bilateral|left] T8/T9|H[right|bilateral|left] T9/T10|H[right|bilateral|left] T10/T11|H[right|bilateral|left] T11/T12|H[right|bilateral|left] T12/L1} V{facet joint(s)|junction(s)}, likely due to degenerative arthritis."
      },
      {
        shortcut: "chestmuscle", active: true, location: ["chest"], type: ["inf&phy", "muscle"],
        description: "intercostal muscle physiologic uptake",
        main: "Linear increased FDG uptake in the M{H[right|bilateral|left] intercostcal|} muscle(s), favoring muscle stress related physiologic change."
      },
      {
        shortcut: "ctchest", active: true, location: ["chest"], type: [],
        description: "CT chest incidental findings",
        main: "M{coronary artery H[+|mild|severe] calcification; |emphysematous change of both lungs; |s/p H[right|bilateral|left] mastectomy; |fibrocystic change of bilateral breast; }"
      }
    ],

    /* ────────── Abdomen ────────── */
    "Abdomen": [
      {
        shortcut: "colonnd", active: true, location: ["bowel"], type: ["nodule"],
        description: "colon with nodular lesion",
        main: "Nodular V{mild increased|+increased|intense} FDG uptake in the M{ascending colon|transverse colon|descending colon|recto-sigmoid colon| rectum} V{persisted in the delay image|+}. Adenoma is suspected first V{+|but malignancy cannot be ruled out}."
      },
      {
        shortcut: "gas", active: true, location: ["stomach"], type: [],
        description: "gastric lesion (favoring inflammation)",
        main: "V{Mild|+Mildly increased|Increased} FDG uptake in the M{+gastric antrum|gastric pyloric region}, possibly due to V{+inflammation|mild inflammation}."
      },
      {
        shortcut: "filling defect", active: true, location: ["bowel"], type: [],
        description: "colon filling defect",
        main: "A small focus of nodular V{mildly increased|+increased|intense} FDG uptake in the V{ascending|transverse|descending|sigmoid} colon, corresponding to a small filling defect of contrast enema shown on the delayed scan images."
      },
      {
        shortcut: "col", active: true, location: ["bowel"], type: ["inf&phy"],
        description: "colon physiologic / bowel uptake",
        main: "V{Heterogeneously|+Diffusely|Segmentally} V{mild|+mildly increased|increased} FDG uptake in the M{ascending|transverse|descending|rectosigmoid} colon could be due to bowel physiologic change V{+|but preclude detail evaluation of colon}V{+.|Suggest correlation with scheduled colonoscopic examination.}"
      },
      {
        shortcut: "liver", active: true, location: ["liver"], type: [],
        description: "liver lesion",
        main: "A V{hypodense|isodense|hyperdense} lesion with V{+|mild increased|intense} FDG uptake V{similar to normal hepatic parenchyma+|} in the H{right|bilateral|left} hepatic lobe(s), V{possible hemangioma|possible tumor uptake}. C{Possible block[5] in the block[4] hepatic lobe(s).|Suggest GI OPD further examination.}"
      },
      {
        shortcut: "adrenal", active: true, location: ["adrenal"], type: [],
        description: "adrenal uptake / thickening",
        main: "V{+|Focal|nodular} V{increased|mild increased+|intense} FDG uptake with V{+thickening change|nodular change} in H{the right|bilateral|the left} adrenal gland(s)."
      },
      {
        shortcut: "Ldjd", active: true, location: ["bone"], type: ["inf&phy"],
        description: "lumbar facet joint degenerative arthritis",
        main: "Focal H{+mild|} increased FDG uptake in the M{H[right|bilateral|left] L1/L2|H[right|bilateral|left] L2/L3|H[right|bilateral|left] L3/L4|H[right|bilateral|left] L4/L5|H[right|bilateral|left] L5/S1} V{facet joint(s)|junction(s)}, likely due to degenerative arthritis."
      },
      {
        shortcut: "ctabd", active: true, location: ["abdominal cavity"], type: [],
        description: "CT abdomen incidental findings",
        main: "m{H[right|bilateral|left] renal stone; |H[right|bilateral|left] renal cyst; |H[right|bilateral|left] renal complex cyst; |H[right|bilateral|left] renal angiomyolipoma; |H[right|bilateral|left] adrenal nodule; |H[right|bilateral|left] hepatic cyst; |H[right|bilateral|left] duplex kidney; |fatty liver; |intrahepatic calcification; |splenomegaly; |gallbladder stone;  |s/p cholecystectomy;|accessory spleen;}"
      }
    ],

    /* ────────── Pelvic ────────── */
    "Pelvic": [
      {
        shortcut: "mc", active: true, location: ["uterus&bo"], type: ["inf&phy"],
        description: "menstrual cycle physiologic uptake",
        main: "M{H[Mild|Mildly increased|Increased] FDG accumulation in the uterine cavity| focal increased FDG uptake in the H[right|bilateral|left] tubo-ovarian region(s)}. Physiologic uptake associated with menstrual cycle is likely."
      },
      {
        shortcut: "myoma", active: true, location: ["uterus&bo"], type: ["inf&phy"],
        description: "uterine myoma",
        main: "bulging uterine contour V{|with mild increased FDG uptake|with intense FDG uptake} in the H{right|anterior|posterior|left} uterine wall is possibly due to myoma"
      },
      {
        shortcut: "prostate", active: true, location: ["prostate"], type: [],
        description: "prostate hyperplasia / prostatitis",
        main: "Focal V{+mild|mildly increased} FDG uptake in the H{right|left} portion of prostate, possibly due to prostatic hyperplasia or prostatitis."
      },
      {
        shortcut: "inguinalln", active: true, location: [], type: ["lymph node"],
        description: "inguinal lymphadenitis",
        main: "There is mildly increased FDG uptake in H{the right|+bilateral|the left} inguinal small lymph nodes V{+|with fatty hilum}, favoring V{+lymphadenitis|reactive hyperplasia}."
      },
      {
        shortcut: "ctpel", active: true, location: [], type: [],
        description: "CT pelvis incidental findings",
        main: "M{H[mild|] enlarged prostate;|H[right|bilateral|left] adnexal cyst;|s/p hysterectomy; |H[right|bilateral|left] hydrocele}"
      },
      {
        shortcut: "gs", active: true, location: [], type: ["inf&phy"],
        description: "hemorrhoid / anorectal uptake",
        main: "Focal V{mild|+mildly increased|increased} FDG uptake in the V{+anorectal|anal} region, possibly due to hemorrhoid."
      }
    ],

    /* ────────── Others ────────── */
    "Others": [
      {
        shortcut: "tendi", active: true, location: [], type: ["muscle"],
        description: "tendinitis",
        main: "Focal V{mild|mildly increased+|increased} FDG uptake H{in+|lateral to} M{H[the right| bilateral|the left] shoulder joint|H[the right| bilateral|the left] hip joint|H[the right| bilateral|the left] humeral head|H[the right| bilateral|the left] femoral head|greater trochanter of H[the right| bilateral|the left] femur}, likely due to tendinitis."
      },
      {
        shortcut: "djd1", active: true, location: ["bone"], type: ["inf&phy"],
        description: "shoulder/hip degenerative joint disease",
        main: "V{Mild|mildly increased|increased} FDG uptake in the M{H[|right|bilateral|left] shoulder|H[|right|bilateral|left] hip|H[|right|bilateral|left] acromioclavicular|H[|right|bilateral|left] sternoclavicular} joint(s), likely due to V{degenerative change|arthritis|capsulitis}."
      },
      {
        shortcut: "djd2", active: true, location: ["bone"], type: ["inf&phy"],
        description: "shoulder/hip arthritis (simple)",
        main: "V{Mild|Mildly increased|Increased} FDG uptake in H{the right|+bilateral|the left} M{shoulder|hip|facet} joint, likely due to V{degenerative change|arthritis|capsulitis}."
      }
    ],

    /* ────────── WholeBody ────────── */
    "WholeBody": [
      {
        shortcut: "lipoma", active: true, location: [], type: ["muscle"],
        description: "lipoma",
        main: "A fatty mass in the M{H[|right|bilateral|left] neck|H[|right|bilateral|left] shoulder|H[|right|bilateral|left] chest wall|H[|right|bilateral|left] back|H[|right|bilateral|left] flank|H[|right|bilateral|left] buttock|H[|right|bilateral|left] tight}, favoring lipoma."
      },
      {
        shortcut: "bone mets", active: true, location: ["bone"], type: ["malignant"],
        description: "bone metastasis",
        main: "focal H{+|intense} FDG uptake in the M/{H[right|bilateral|left] skull|M[C1|C2|C3|C4|C5|C6|C7]|M[T1|T2|T3|T4|T5|T6|T7|T8|T9|T10|T11|T12]|M[L1|L2|L3|L4|L5]|C/T/L/S-spine|H[right|bilateral|left] rib cages|LE[]th rib|sternum|H[right|bilateral|left] scapula|H[right|bilateral|left] clavicle|sacrum|H[right|bilateral|left] pelvic bones|H[right|bilateral|left] ilium|H[right|bilateral|left] ischium|H[right|bilateral|left] pubis|H[right|bilateral|left] H[proximal|distal] humeri|H[right|bilateral|left] H[proximal|distal] femora},"
      },
      {
        shortcut: "marrowhyper", active: true, location: ["bone"], type: ["inf&phy", "malignant"],
        description: "bone marrow hyperplasia",
        main: "V{+Diffuse|Heterogenerous|} V{+mild|} increased FDG uptake in the bone marrow of axial skeleton, possibly due to V{anemia-related|C/T-related} bone marrow hyperplasia."
      }
    ],

    /* ────────── FollowUp ────────── */
    "FollowUp": [
      {
        shortcut: "ccfu", active: true, location: [], type: ["Abb"],
        description: "clinical correlation and follow up",
        main: "Clinical correlation and follow up are recommended."
      },
      {
        shortcut: "ccfm", active: true, location: [], type: ["Abb"],
        description: "clinical correlation and further management",
        main: "Clinical correlation and further management are recommended."
      },
      {
        shortcut: "bg", active: true, location: [], type: ["Abb"],
        description: "Blood glucose",
        main: "V{Blood glucose: LE[] mg/dL.}"
      },
      {
        shortcut: "hcc", active: true, location: ["liver"], type: ["Abb"],
        description: "HCC low FDG sensitivity note",
        main: "Clinical correlation with other imaging studies is advised, in view of lower sensitivity of PET for HCC owing to low FDG-avidity nature."
      },
      {
        shortcut: "less sensitive", active: true, location: [], type: ["Abb"],
        description: "marginal zone lymphoma sensitivity note",
        main: "The sensitivity of FDG PET/CT scan in marginal zone lymphoma is relatively lower due to indolent metabolic nature in marginal zone lymphoma. Suggest other image study correlation."
      },
      {
        shortcut: "gerd f/u", active: true, location: [], type: ["Abb"],
        description: "GERD / gastric inflammation follow up",
        main: "Possible M{reflux esophagitis|+inflammation in the gastric antrum|pyloric region}. Suggest GI OPD follow up, if symptomatic."
      },
      {
        shortcut: "dentist", active: true, location: [], type: ["Abb"],
        description: "dentist OPD follow up",
        main: "Possible M{right upper|right lower|left upper|left lower|bilateral upper|bilateral lower|the anterior} dentopathy. Suggest dentist OPD follow up, if symptomatic."
      },
      {
        shortcut: "fu1y", active: true, location: [], type: ["Abb"],
        description: "follow up 1 year",
        main: "Suggest follow up one year later."
      },
      {
        shortcut: "ldct", active: true, location: [], type: ["Abb"],
        description: "Low-Dose CT follow up suggestion",
        main: "Suggest follow up with Low-Dose CT and/or FDG PET/CT V{3 months|6 months|+one year} later."
      },
      {
        shortcut: "nore", active: true, location: [], type: ["Abb"],
        description: "no evidence of recurrence / metastasis",
        main: "V{No obvious hypermetabolic lesion is detected to suggest evidence of tumoral recurrence or metastasis|No obvious hypermetabolic lesion is detected to suggest evidence of tumoral uptake}. V{+|Regular clinical follow up is recommended.}"
      },
      {
        shortcut: "opd", active: true, location: [], type: ["Abb"],
        description: "OPD follow up suggestion",
        main: "Suggest G3{ENT|dentist|chest|chest surgery|cardiologic|GI|GS|urologic|endocrinologic|gynecologic|dermatalogic|breast surgery|orthopedic|rehabilitation} OPD V{+follow up|cross checkup|further survey} V{+| if symptomatic}."
      },
      {
        shortcut: "bfu", active: true, location: [], type: ["Abb"],
        description: "breast follow up annually",
        main: "Breast ultrasound and mammography regular follow up annually is recommended. "
      },
      {
        shortcut: "stage", active: true, location: [], type: ["Abb"],
        description: "imaging stage",
        main: "The tentative imaging stage:"
      },
      {
        shortcut: "lgi", active: true, location: [], type: ["Abb"],
        description: "colonoscopy suggestion",
        main: "V{+Optional baseline colonoscopy is suggested if not done in recent 2 years|Suggest colonoscopy correlation}."
      }
    ],

    /* ────────── Abbreviation ────────── */
    "Abbreviation": [
      {
        shortcut: "rul", active: true, location: [], type: ["Abb"],
        description: "right upper lung + measuring",
        main: "right upper lungV{(LE[]cm)|(LE[]cm, image:LE[])|(LE[]cm, maxSUV:LE[])|(LE[]xLE[]cm, maxSUV:LE[])|(LE[]xLE[]xLE[]cm, maxSUV:LE[])}"
      },
      {
        shortcut: "rml", active: true, location: [], type: ["Abb"],
        description: "right middle lung + measuring",
        main: "right middle lungV{(LE[]cm)|(LE[]cm, image:LE[])|(LE[]cm, maxSUV:LE[])|(LE[]xLE[]cm, maxSUV:LE[])|(LE[]xLE[]xLE[]cm, maxSUV:LE[])}"
      },
      {
        shortcut: "rll", active: true, location: [], type: ["Abb"],
        description: "right lower lung + measuring",
        main: "right lower lungV{(LE[]cm)|(LE[]cm, image:LE[])|(LE[]cm, maxSUV:LE[])|(LE[]xLE[]cm, maxSUV:LE[])|(LE[]xLE[]xLE[]cm, maxSUV:LE[])}"
      },
      {
        shortcut: "lul", active: true, location: [], type: ["Abb"],
        description: "left upper lung + measuring",
        main: "left upper lungV{(LE[]cm)|(LE[]cm, image:LE[])|(LE[]cm, maxSUV:LE[])|(LE[]xLE[]cm, maxSUV:LE[])|(LE[]xLE[]xLE[]cm, maxSUV:LE[])}"
      },
      {
        shortcut: "lll", active: true, location: [], type: ["Abb"],
        description: "left lower lung + measuring",
        main: "left lower lungV{(LE[]cm)|(LE[]cm, image:LE[])|(LE[]cm, maxSUV:LE[])|(LE[]xLE[]cm, maxSUV:LE[])|(LE[]xLE[]xLE[]cm, maxSUV:LE[])}"
      },
      {
        shortcut: "nonew", active: true, location: [], type: ["Abb"],
        description: "no new hypermetabolic lesion",
        main: "No new focus of abnormal hypermetabolic lesion to suggest evidence of recurrence or metastasis. "
      }
    ],

    /* ────────── Cancer ────────── */
    "Cancer": [
      {
        shortcut: "lungca", active: true, location: ["lung"], type: ["malignant"],
        description: "Lung cancer",
        main: "H{A|} H{nodule|tumor|mass} H{with|with focal|with diffuse|with mottling} V{mild increased|increased|intense} FDG uptake in the M{H[apical|posterior|anterior] RUL|H[lateral|medial] RML|H[superior|medial|anterior|lateral|posterior] RLL|H[apical|posterior|anterior|lingula] LUL|H[superior|medial|anterior|lateral|posterior] LLL} H{,|, extent to|involving} M{H[right|left] chest wall|pericardium|H[right|left] mediastinum|diaphragm|heart|LE[] H[artery|vein|aorta]|carina|trachea|esophagus|TLE[] vertebra} M{and satellite nodule(s)|and separate H[tumor(s)|nodule(s)] in the LE[]}"
      },
      {
        shortcut: "nasoca", active: true, location: ["nasopharynx"], type: ["malignant"],
        description: "Nasopharyngeal cancer",
        main: "V{|A bulged tumor with H[intense|moderate increased] FDG uptake in the H[right|bilateral|left] nasopharynx H[|involving]} M{H[right|bilateral|left] oropharynx |H[right|bilateral|left] nasal cavity |H[right|bilateral|left] parapharyngeal space |H[right|bilateral|left] medial pterygoid muscle |H[right|bilateral|left] lateral pterygoid muscle |H[right|bilateral|left] prevertebral muscle |skull base |LE[] vertebra |pterygoid structures |paranasal sinuse |intracranial content  |cranial nerves |hypopharynx |orbit |parotid gland}\nV{| H[A|Several|multiple] H[|enlarged] lymph node(s) with H[intense|moderate increased] FDG uptake in the} M{right cervical level M[I|II|III|IV|V|VI]|bilateral cervical level M[I|II|III|IV|V|VI]|left cervical level M[I|II|III|IV|V|VI]}"
      },
      {
        shortcut: "oralca", active: true, location: ["oral"], type: ["malignant"],
        description: "Oral cancer",
        main: "H{A nodule|A mass|A tumor} H{with|with focal|with diffuse|with mottling} V{mild increased|increased|intense} FDG uptake in the M{H[right|bilateral|left] tongue|H[right|bilateral|left] buccal|H[right|bilateral|left] H[upper|lower] lip|H[right|bilateral|left] H[upper|lower] gum|H[right|bilateral|left] H[hard|soft] palate|H[right|left] retromolar region} V{|(size:LE[],maxSUV:LE[])} H{,|,extend to|involving}  M{through cortical LE[] bone|floor of mouth|skin of face|H[right|bilateral|left] H[maxillary|ethmoid|sphnoid] sinus|H[right|bilateral|left] masticator space|H[right|bilateral|left] pterygoid plates|H[right|bilateral|left] skull base|encases H[right|bilateral|left] internal carotid artery} "
      },
      {
        shortcut: "wlaps", active: true, location: [], type: ["lymph node", "malignant"],
        description: "Whole body lymphadenopathy",
        main: "H{A|Few|Several|Numerous|Multiple} H{small|borderline-sized|various-sized|enlarged} lymph nodes with H{nodular|foci of|focal|diffuse} H{mild increased|moderate increased|increased|intense} FDG uptake in the M/{H[right|bilateral|left] M[parotid gland|occipital]} M/{right cervical level M[I|II|III|IV|V|VI]|bilateral cervical level M[I|II|III|IV|V|VI]|left cervical level M[I|II|III|IV|V|VI]|H[right|bilateral|left] supraclavicular|H[right|bilateral|left] para-tracheal|H[right|bilateral|left] mediastinal|H[right|bilateral|left] hilar|H[right|bilateral|left] internal mammary| paracardiac|paragastric|periceliac |para-aortic/caval|H[right|bilateral|left] M[common|external|internal] iliac|H[right|bilateral|left] pelvic side wall|H[right|bilateral|left] inguinal|LE[]} region(s)."
      }
    ]
  }
};
