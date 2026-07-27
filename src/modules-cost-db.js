/**
 * Static per-module resource cost table keyed by X4 macro name.
 *
 * Values are consumed directly when available; heuristic estimation is only
 * used when a macro is not present in this table.
 */
export const MODULES_COST_DB = {
  "struct_arg_base_01_macro": {
    "claytronics": 14,
    "energyCells": 27,
    "hullParts": 50
  },
  "struct_arg_base_02_macro": {
    "claytronics": 17,
    "energyCells": 34,
    "hullParts": 62
  },
  "struct_arg_base_03_macro": {
    "claytronics": 18,
    "energyCells": 37,
    "hullParts": 68
  },
  "struct_arg_cross_01_macro": {
    "claytronics": 12,
    "energyCells": 24,
    "hullParts": 44
  },
  "struct_arg_vertical_01_macro": {
    "claytronics": 10,
    "energyCells": 20,
    "hullParts": 36
  },
  "struct_arg_vertical_02_macro": {
    "claytronics": 13,
    "energyCells": 26,
    "hullParts": 48
  },
  "defence_arg_claim_01_macro": {
    "claytronics": 137,
    "energyCells": 274,
    "hullParts": 501
  },
  "defence_arg_disc_01_macro": {
    "claytronics": 98,
    "energyCells": 196,
    "hullParts": 359
  },
  "defence_arg_tube_01_macro": {
    "claytronics": 85,
    "energyCells": 170,
    "hullParts": 312
  },
  "dockarea_arg_m_station_01_macro": {
    "claytronics": 54,
    "energyCells": 108,
    "hullParts": 198
  },
  "dockarea_arg_m_station_01_hightech_macro": {
    "claytronics": 58,
    "energyCells": 116,
    "hullParts": 212
  },
  "dockarea_arg_m_station_01_lowtech_macro": {
    "claytronics": 51,
    "energyCells": 101,
    "hullParts": 185
  },
  "dockarea_arg_m_station_02_macro": {
    "claytronics": 78,
    "energyCells": 155,
    "hullParts": 284
  },
  "dockarea_arg_m_station_02_hightech_macro": {
    "claytronics": 80,
    "energyCells": 161,
    "hullParts": 294
  },
  "dockarea_arg_m_station_02_lowtech_macro": {
    "claytronics": 75,
    "energyCells": 150,
    "hullParts": 274
  },
  "dockarea_arg_m_02_tradestation_01_macro": {
    "claytronics": 116,
    "energyCells": 232,
    "hullParts": 424
  },
  "hab_arg_l_01_macro": {
    "claytronics": 191,
    "energyCells": 383,
    "hullParts": 700
  },
  "hab_arg_m_01_macro": {
    "claytronics": 135,
    "energyCells": 271,
    "hullParts": 495
  },
  "hab_arg_s_01_macro": {
    "claytronics": 94,
    "energyCells": 188,
    "hullParts": 343
  },
  "pier_arg_harbor_01_macro": {
    "claytronics": 542,
    "energyCells": 1083,
    "hullParts": 1980
  },
  "pier_arg_harbor_02_macro": {
    "claytronics": 313,
    "energyCells": 625,
    "hullParts": 1143
  },
  "pier_arg_harbor_03_macro": {
    "claytronics": 625,
    "energyCells": 1250,
    "hullParts": 2287
  },
  "prod_arg_foodrations_macro": {
    "claytronics": 262,
    "energyCells": 525,
    "hullParts": 961
  },
  "prod_arg_meat_macro": {
    "claytronics": 248,
    "energyCells": 497,
    "hullParts": 910
  },
  "prod_arg_medicalsupplies_macro": {
    "claytronics": 225,
    "energyCells": 450,
    "hullParts": 823
  },
  "prod_arg_spacefuel_macro": {
    "claytronics": 319,
    "energyCells": 638,
    "hullParts": 1168
  },
  "prod_arg_wheat_macro": {
    "claytronics": 296,
    "energyCells": 592,
    "hullParts": 1084
  },
  "storage_arg_l_container_01_macro": {
    "claytronics": 115,
    "energyCells": 230,
    "hullParts": 421
  },
  "storage_arg_m_container_01_macro": {
    "claytronics": 82,
    "energyCells": 163,
    "hullParts": 299
  },
  "storage_arg_s_container_01_macro": {
    "claytronics": 52,
    "energyCells": 103,
    "hullParts": 189
  },
  "storage_arg_l_liquid_01_macro": {
    "claytronics": 115,
    "energyCells": 230,
    "hullParts": 421
  },
  "storage_arg_m_liquid_01_macro": {
    "claytronics": 82,
    "energyCells": 163,
    "hullParts": 299
  },
  "storage_arg_s_liquid_01_macro": {
    "claytronics": 52,
    "energyCells": 103,
    "hullParts": 189
  },
  "storage_arg_l_solid_01_macro": {
    "claytronics": 115,
    "energyCells": 230,
    "hullParts": 421
  },
  "storage_arg_m_solid_01_macro": {
    "claytronics": 82,
    "energyCells": 163,
    "hullParts": 299
  },
  "storage_arg_s_solid_01_macro": {
    "claytronics": 52,
    "energyCells": 103,
    "hullParts": 189
  },
  "buildmodule_gen_ships_m_dockarea_01_macro": {
    "claytronics": 3312,
    "energyCells": 6620,
    "hullParts": 12112
  },
  "buildmodule_gen_ships_l_macro": {
    "claytronics": 1866,
    "energyCells": 3731,
    "hullParts": 6826
  },
  "buildmodule_gen_ships_xl_macro": {
    "claytronics": 2434,
    "energyCells": 4866,
    "hullParts": 8902
  },
  "buildmodule_gen_equip_m_dockarea_01_macro": {
    "claytronics": 1604,
    "energyCells": 3312,
    "hullParts": 6620
  },
  "buildmodule_gen_equip_l_macro": {
    "claytronics": 931,
    "energyCells": 1866,
    "hullParts": 3731
  },
  "buildmodule_gen_equip_xl_macro": {
    "claytronics": 1212,
    "energyCells": 2434,
    "hullParts": 4866
  },
  "proc_gen_scrapworks_macro": {
    "claytronics": 178,
    "energyCells": 162,
    "hullParts": 733
  },
  "prod_gen_advancedcomposites_macro": {
    "claytronics": 648,
    "energyCells": 1296,
    "hullParts": 2373
  },
  "prod_gen_advancedelectronics_macro": {
    "claytronics": 482,
    "energyCells": 965,
    "hullParts": 1767
  },
  "prod_gen_antimattercells_macro": {
    "claytronics": 69,
    "energyCells": 138,
    "hullParts": 253
  },
  "prod_gen_antimatterconverters_macro": {
    "claytronics": 1780,
    "energyCells": 3560,
    "hullParts": 6516
  },
  "prod_gen_claytronics_macro": {
    "claytronics": 2822,
    "energyCells": 5642,
    "hullParts": 10327
  },
  "prod_gen_dronecomponents_macro": {
    "claytronics": 1225,
    "energyCells": 2449,
    "hullParts": 4483
  },
  "prod_gen_energycells_macro": {
    "claytronics": 260,
    "energyCells": 520,
    "hullParts": 951
  },
  "prod_gen_engineparts_macro": {
    "claytronics": 389,
    "energyCells": 779,
    "hullParts": 1426
  },
  "prod_gen_fieldcoils_macro": {
    "claytronics": 1735,
    "energyCells": 3470,
    "hullParts": 6351
  },
  "prod_gen_graphene_macro": {
    "claytronics": 28,
    "energyCells": 57,
    "hullParts": 104
  },
  "prod_gen_hullparts_macro": {
    "claytronics": 614,
    "energyCells": 1229,
    "hullParts": 2249
  },
  "prod_gen_microchips_macro": {
    "claytronics": 758,
    "energyCells": 1516,
    "hullParts": 2774
  },
  "prod_gen_missilecomponents_macro": {
    "claytronics": 35,
    "energyCells": 71,
    "hullParts": 131
  },
  "prod_gen_plasmaconductors_macro": {
    "claytronics": 473,
    "energyCells": 946,
    "hullParts": 1732
  },
  "prod_gen_quantumtubes_macro": {
    "claytronics": 380,
    "energyCells": 761,
    "hullParts": 1394
  },
  "prod_gen_refinedmetals_macro": {
    "claytronics": 36,
    "energyCells": 73,
    "hullParts": 135
  },
  "prod_gen_scanningarrays_macro": {
    "claytronics": 629,
    "energyCells": 1259,
    "hullParts": 2305
  },
  "prod_gen_scrap_recycler_macro": {
    "claytronics": 300,
    "energyCells": 600,
    "hullParts": 1100
  },
  "prod_gen_shieldcomponents_macro": {
    "claytronics": 432,
    "energyCells": 865,
    "hullParts": 1583
  },
  "prod_gen_siliconwafers_macro": {
    "claytronics": 74,
    "energyCells": 149,
    "hullParts": 273
  },
  "prod_gen_smartchips_macro": {
    "claytronics": 126,
    "energyCells": 253,
    "hullParts": 464
  },
  "prod_gen_spices_macro": {
    "claytronics": 139,
    "energyCells": 278,
    "hullParts": 510
  },
  "prod_gen_superfluidcoolant_macro": {
    "claytronics": 25,
    "energyCells": 51,
    "hullParts": 94
  },
  "prod_gen_turretcomponents_macro": {
    "claytronics": 475,
    "energyCells": 951,
    "hullParts": 1741
  },
  "prod_gen_water_macro": {
    "claytronics": 36,
    "energyCells": 72,
    "hullParts": 132
  },
  "prod_gen_weaponcomponents_macro": {
    "claytronics": 396,
    "energyCells": 793,
    "hullParts": 1452
  },
  "struct_par_base_01_macro": {
    "claytronics": 12,
    "energyCells": 23,
    "hullParts": 42
  },
  "struct_par_base_02_macro": {
    "claytronics": 17,
    "energyCells": 34,
    "hullParts": 61
  },
  "struct_par_base_03_macro": {
    "claytronics": 21,
    "energyCells": 43,
    "hullParts": 78
  },
  "struct_par_cross_01_macro": {
    "claytronics": 10,
    "energyCells": 21,
    "hullParts": 38
  },
  "struct_par_cross_02_macro": {
    "claytronics": 21,
    "energyCells": 43,
    "hullParts": 78
  },
  "struct_par_cross_03_macro": {
    "claytronics": 17,
    "energyCells": 34,
    "hullParts": 61
  },
  "struct_par_vertical_01_macro": {
    "claytronics": 10,
    "energyCells": 20,
    "hullParts": 36
  },
  "struct_par_vertical_02_macro": {
    "claytronics": 13,
    "energyCells": 26,
    "hullParts": 48
  },
  "defence_par_claim_01_macro": {
    "claytronics": 140,
    "energyCells": 279,
    "hullParts": 511
  },
  "defence_par_disc_01_macro": {
    "claytronics": 98,
    "energyCells": 196,
    "hullParts": 359
  },
  "defence_par_tube_01_macro": {
    "claytronics": 85,
    "energyCells": 170,
    "hullParts": 312
  },
  "hab_par_l_01_macro": {
    "claytronics": 210,
    "energyCells": 419,
    "hullParts": 767
  },
  "hab_par_m_01_macro": {
    "claytronics": 135,
    "energyCells": 271,
    "hullParts": 495
  },
  "hab_par_s_01_macro": {
    "claytronics": 94,
    "energyCells": 188,
    "hullParts": 343
  },
  "pier_par_harbor_01_macro": {
    "claytronics": 563,
    "energyCells": 1125,
    "hullParts": 2058
  },
  "pier_par_harbor_02_macro": {
    "claytronics": 325,
    "energyCells": 650,
    "hullParts": 1188
  },
  "pier_par_harbor_03_macro": {
    "claytronics": 650,
    "energyCells": 1299,
    "hullParts": 2377
  },
  "prod_par_majadust_macro": {
    "claytronics": 373,
    "energyCells": 746,
    "hullParts": 1366
  },
  "prod_par_majasnails_macro": {
    "claytronics": 248,
    "energyCells": 497,
    "hullParts": 910
  },
  "prod_par_medicalsupplies_macro": {
    "claytronics": 226,
    "energyCells": 451,
    "hullParts": 827
  },
  "prod_par_sojabeans_macro": {
    "claytronics": 296,
    "energyCells": 592,
    "hullParts": 1084
  },
  "prod_par_sojahusk_macro": {
    "claytronics": 316,
    "energyCells": 633,
    "hullParts": 1159
  },
  "storage_par_l_container_01_macro": {
    "claytronics": 124,
    "energyCells": 247,
    "hullParts": 453
  },
  "storage_par_m_container_01_macro": {
    "claytronics": 84,
    "energyCells": 169,
    "hullParts": 309
  },
  "storage_par_s_container_01_macro": {
    "claytronics": 56,
    "energyCells": 112,
    "hullParts": 204
  },
  "storage_par_l_liquid_01_macro": {
    "claytronics": 124,
    "energyCells": 247,
    "hullParts": 453
  },
  "storage_par_m_liquid_01_macro": {
    "claytronics": 84,
    "energyCells": 169,
    "hullParts": 309
  },
  "storage_par_s_liquid_01_macro": {
    "claytronics": 56,
    "energyCells": 112,
    "hullParts": 204
  },
  "storage_par_l_solid_01_macro": {
    "claytronics": 124,
    "energyCells": 247,
    "hullParts": 453
  },
  "storage_par_m_solid_01_macro": {
    "claytronics": 84,
    "energyCells": 169,
    "hullParts": 309
  },
  "storage_par_s_solid_01_macro": {
    "claytronics": 56,
    "energyCells": 112,
    "hullParts": 204
  },
  "struct_tel_base_01_macro": {
    "claytronics": 14,
    "energyCells": 27,
    "hullParts": 50
  },
  "struct_tel_base_02_macro": {
    "claytronics": 17,
    "energyCells": 34,
    "hullParts": 62
  },
  "struct_tel_base_03_macro": {
    "claytronics": 18,
    "energyCells": 37,
    "hullParts": 68
  },
  "struct_tel_cross_01_macro": {
    "claytronics": 12,
    "energyCells": 24,
    "hullParts": 44
  },
  "struct_tel_vertical_01_macro": {
    "claytronics": 10,
    "energyCells": 20,
    "hullParts": 36
  },
  "struct_tel_vertical_02_macro": {
    "claytronics": 13,
    "energyCells": 26,
    "hullParts": 48
  },
  "defence_tel_claim_01_macro": {
    "claytronics": 138,
    "energyCells": 275,
    "hullParts": 503
  },
  "defence_tel_disc_01_macro": {
    "claytronics": 98,
    "energyCells": 196,
    "hullParts": 359
  },
  "defence_tel_tube_01_macro": {
    "claytronics": 85,
    "energyCells": 170,
    "hullParts": 312
  },
  "hab_tel_l_01_macro": {
    "claytronics": 182,
    "energyCells": 363,
    "hullParts": 664
  },
  "hab_tel_m_01_macro": {
    "claytronics": 121,
    "energyCells": 242,
    "hullParts": 443
  },
  "hab_tel_s_01_macro": {
    "claytronics": 86,
    "energyCells": 171,
    "hullParts": 313
  },
  "pier_tel_harbor_01_macro": {
    "claytronics": 542,
    "energyCells": 1083,
    "hullParts": 1980
  },
  "pier_tel_harbor_02_macro": {
    "claytronics": 313,
    "energyCells": 625,
    "hullParts": 1143
  },
  "pier_tel_harbor_03_macro": {
    "claytronics": 625,
    "energyCells": 1250,
    "hullParts": 2287
  },
  "prod_tel_advancedcomposites_macro": {
    "claytronics": 628,
    "energyCells": 1241,
    "hullParts": 2300
  },
  "prod_tel_engineparts_macro": {
    "claytronics": 394,
    "energyCells": 778,
    "hullParts": 1443
  },
  "prod_tel_hullparts_macro": {
    "claytronics": 614,
    "energyCells": 1213,
    "hullParts": 2249
  },
  "prod_tel_medicalsupplies_macro": {
    "claytronics": 224,
    "energyCells": 448,
    "hullParts": 822
  },
  "prod_tel_nostropoil_macro": {
    "claytronics": 289,
    "energyCells": 579,
    "hullParts": 1063
  },
  "prod_tel_scanningarrays_macro": {
    "claytronics": 637,
    "energyCells": 1259,
    "hullParts": 2333
  },
  "prod_tel_spaceweed_macro": {
    "claytronics": 639,
    "energyCells": 1277,
    "hullParts": 2338
  },
  "prod_tel_sunriseflowers_macro": {
    "claytronics": 296,
    "energyCells": 592,
    "hullParts": 1087
  },
  "prod_tel_swampplants_macro": {
    "claytronics": 639,
    "energyCells": 1277,
    "hullParts": 2338
  },
  "prod_tel_teladianium_macro": {
    "claytronics": 50,
    "energyCells": 101,
    "hullParts": 185
  },
  "storage_tel_l_container_01_macro": {
    "claytronics": 112,
    "energyCells": 223,
    "hullParts": 408
  },
  "storage_tel_m_container_01_macro": {
    "claytronics": 78,
    "energyCells": 156,
    "hullParts": 285
  },
  "storage_tel_s_container_01_macro": {
    "claytronics": 51,
    "energyCells": 102,
    "hullParts": 187
  },
  "storage_tel_l_liquid_01_macro": {
    "claytronics": 112,
    "energyCells": 223,
    "hullParts": 408
  },
  "storage_tel_m_liquid_01_macro": {
    "claytronics": 78,
    "energyCells": 156,
    "hullParts": 285
  },
  "storage_tel_s_liquid_01_macro": {
    "claytronics": 51,
    "energyCells": 102,
    "hullParts": 187
  },
  "storage_tel_l_solid_01_macro": {
    "claytronics": 112,
    "energyCells": 223,
    "hullParts": 408
  },
  "storage_tel_m_solid_01_macro": {
    "claytronics": 78,
    "energyCells": 156,
    "hullParts": 285
  },
  "storage_tel_s_solid_01_macro": {
    "claytronics": 51,
    "energyCells": 102,
    "hullParts": 187
  },
  "struct_spl_base_01_macro": {
    "claytronics": 14,
    "energyCells": 27,
    "hullParts": 50
  },
  "struct_spl_base_02_macro": {
    "claytronics": 17,
    "energyCells": 34,
    "hullParts": 62
  },
  "struct_spl_base_03_macro": {
    "claytronics": 18,
    "energyCells": 37,
    "hullParts": 68
  },
  "struct_spl_cross_01_macro": {
    "claytronics": 12,
    "energyCells": 24,
    "hullParts": 44
  },
  "struct_spl_vertical_01_macro": {
    "claytronics": 10,
    "energyCells": 20,
    "hullParts": 36
  },
  "struct_spl_vertical_02_macro": {
    "claytronics": 13,
    "energyCells": 26,
    "hullParts": 48
  },
  "defence_spl_claim_01_macro": {
    "claytronics": 138,
    "energyCells": 276,
    "hullParts": 505
  },
  "defence_spl_disc_01_macro": {
    "claytronics": 105,
    "energyCells": 210,
    "hullParts": 384
  },
  "defence_spl_tube_01_macro": {
    "claytronics": 105,
    "energyCells": 210,
    "hullParts": 384
  },
  "hab_spl_l_01_macro": {
    "claytronics": 191,
    "energyCells": 383,
    "hullParts": 700
  },
  "hab_spl_m_01_macro": {
    "claytronics": 135,
    "energyCells": 271,
    "hullParts": 495
  },
  "hab_spl_s_01_macro": {
    "claytronics": 94,
    "energyCells": 188,
    "hullParts": 343
  },
  "pier_spl_harbor_01_macro": {
    "claytronics": 542,
    "energyCells": 1083,
    "hullParts": 1980
  },
  "pier_spl_harbor_02_macro": {
    "claytronics": 313,
    "energyCells": 625,
    "hullParts": 1143
  },
  "pier_spl_harbor_03_macro": {
    "claytronics": 625,
    "energyCells": 1250,
    "hullParts": 2287
  },
  "prod_spl_cheltmeat_macro": {
    "claytronics": 282,
    "energyCells": 256,
    "hullParts": 1158
  },
  "prod_spl_medicalsupplies_macro": {
    "claytronics": 248,
    "energyCells": 451,
    "hullParts": 910
  },
  "prod_spl_scruffinfruit_macro": {
    "claytronics": 335,
    "energyCells": 305,
    "hullParts": 1377
  },
  "storage_spl_l_container_01_macro": {
    "claytronics": 135,
    "energyCells": 270,
    "hullParts": 494
  },
  "storage_spl_m_container_01_macro": {
    "claytronics": 90,
    "energyCells": 180,
    "hullParts": 329
  },
  "storage_spl_s_container_01_macro": {
    "claytronics": 61,
    "energyCells": 121,
    "hullParts": 222
  },
  "storage_spl_l_liquid_01_macro": {
    "claytronics": 135,
    "energyCells": 270,
    "hullParts": 494
  },
  "storage_spl_m_liquid_01_macro": {
    "claytronics": 90,
    "energyCells": 180,
    "hullParts": 329
  },
  "storage_spl_s_liquid_01_macro": {
    "claytronics": 61,
    "energyCells": 121,
    "hullParts": 222
  },
  "storage_spl_l_solid_01_macro": {
    "claytronics": 135,
    "energyCells": 270,
    "hullParts": 494
  },
  "storage_spl_m_solid_01_macro": {
    "claytronics": 90,
    "energyCells": 180,
    "hullParts": 329
  },
  "storage_spl_s_solid_01_macro": {
    "claytronics": 61,
    "energyCells": 121,
    "hullParts": 222
  },
  "buildmodule_ter_ships_m_dockarea_01_macro": {
    "computronicSubstrate": 895,
    "energyCells": 6620,
    "siliconCarbide": 1843
  },
  "buildmodule_ter_ships_l_macro": {
    "computronicSubstrate": 505,
    "energyCells": 3731,
    "siliconCarbide": 1039
  },
  "buildmodule_ter_ships_xl_macro": {
    "computronicSubstrate": 658,
    "energyCells": 4866,
    "siliconCarbide": 1354
  },
  "struct_ter_base_01_macro": {
    "computronicSubstrate": 3,
    "energyCells": 19,
    "siliconCarbide": 5
  },
  "struct_ter_base_02_macro": {
    "computronicSubstrate": 4,
    "energyCells": 27,
    "siliconCarbide": 8
  },
  "struct_ter_base_03_macro": {
    "computronicSubstrate": 5,
    "energyCells": 38,
    "siliconCarbide": 11
  },
  "struct_ter_cross_01_macro": {
    "computronicSubstrate": 5,
    "energyCells": 38,
    "siliconCarbide": 11
  },
  "struct_ter_vertical_01_macro": {
    "computronicSubstrate": 3,
    "energyCells": 19,
    "siliconCarbide": 5
  },
  "struct_ter_vertical_02_macro": {
    "computronicSubstrate": 4,
    "energyCells": 27,
    "siliconCarbide": 8
  },
  "defence_ter_claim_01_macro": {
    "computronicSubstrate": 80,
    "energyCells": 593,
    "siliconCarbide": 165
  },
  "defence_ter_disc_01_macro": {
    "computronicSubstrate": 57,
    "energyCells": 419,
    "siliconCarbide": 117
  },
  "defence_ter_tube_01_macro": {
    "computronicSubstrate": 40,
    "energyCells": 296,
    "siliconCarbide": 83
  },
  "dockarea_ter_m_station_01_hightech_macro": {
    "computronicSubstrate": 11,
    "energyCells": 81,
    "siliconCarbide": 23
  },
  "buildmodule_ter_equip_m_dockarea_01_macro": {
    "computronicSubstrate": 447,
    "energyCells": 3312,
    "siliconCarbide": 921
  },
  "buildmodule_ter_equip_l_macro": {
    "computronicSubstrate": 252,
    "energyCells": 1866,
    "siliconCarbide": 519
  },
  "buildmodule_ter_equip_xl_macro": {
    "computronicSubstrate": 329,
    "energyCells": 2434,
    "siliconCarbide": 677
  },
  "hab_ter_l_01_macro": {
    "computronicSubstrate": 80,
    "energyCells": 593,
    "siliconCarbide": 165
  },
  "hab_ter_m_01_macro": {
    "computronicSubstrate": 57,
    "energyCells": 419,
    "siliconCarbide": 117
  },
  "hab_ter_s_01_macro": {
    "computronicSubstrate": 40,
    "energyCells": 296,
    "siliconCarbide": 83
  },
  "pier_ter_harbor_01_macro": {
    "computronicSubstrate": 146,
    "energyCells": 1083,
    "siliconCarbide": 301
  },
  "pier_ter_harbor_02_macro": {
    "computronicSubstrate": 85,
    "energyCells": 625,
    "siliconCarbide": 174
  },
  "pier_ter_harbor_03_macro": {
    "computronicSubstrate": 169,
    "energyCells": 1250,
    "siliconCarbide": 348
  },
  "pier_ter_harbor_04_macro": {
    "computronicSubstrate": 85,
    "energyCells": 625,
    "siliconCarbide": 174
  },
  "pier_ter_tradestation_01_macro": {
    "computronicSubstrate": 239,
    "energyCells": 1768,
    "siliconCarbide": 492
  },
  "prod_ter_computronicsubstrate_macro": {
    "computronicSubstrate": 238,
    "energyCells": 688,
    "siliconCarbide": 155
  },
  "prod_ter_energycells_macro": {
    "computronicSubstrate": 24,
    "energyCells": 100,
    "siliconCarbide": 20
  },
  "prod_ter_medicalsupplies_macro": {
    "computronicSubstrate": 17,
    "energyCells": 50,
    "siliconCarbide": 11
  },
  "prod_ter_metallicmicrolattice_macro": {
    "computronicSubstrate": 6,
    "energyCells": 18,
    "siliconCarbide": 4
  },
  "prod_ter_proteinpaste_macro": {
    "computronicSubstrate": 73,
    "energyCells": 211,
    "siliconCarbide": 47
  },
  "prod_ter_scrap_recycler_macro": {
    "computronicSubstrate": 99,
    "energyCells": 131,
    "siliconCarbide": 21
  },
  "prod_ter_siliconcarbide_macro": {
    "computronicSubstrate": 40,
    "energyCells": 117,
    "siliconCarbide": 26
  },
  "prod_ter_stimulants_macro": {
    "computronicSubstrate": 140,
    "energyCells": 407,
    "siliconCarbide": 92
  },
  "prod_ter_mre_macro": {
    "computronicSubstrate": 30,
    "energyCells": 89,
    "siliconCarbide": 20
  },
  "storage_ter_l_container_01_macro": {
    "computronicSubstrate": 36,
    "energyCells": 265,
    "siliconCarbide": 74
  },
  "storage_ter_m_container_01_macro": {
    "computronicSubstrate": 24,
    "energyCells": 178,
    "siliconCarbide": 50
  },
  "storage_ter_s_container_01_macro": {
    "computronicSubstrate": 14,
    "energyCells": 103,
    "siliconCarbide": 29
  },
  "storage_ter_l_liquid_01_macro": {
    "computronicSubstrate": 36,
    "energyCells": 265,
    "siliconCarbide": 74
  },
  "storage_ter_m_liquid_01_macro": {
    "computronicSubstrate": 24,
    "energyCells": 178,
    "siliconCarbide": 50
  },
  "storage_ter_s_liquid_01_macro": {
    "computronicSubstrate": 14,
    "energyCells": 103,
    "siliconCarbide": 29
  },
  "storage_ter_l_solid_01_macro": {
    "computronicSubstrate": 36,
    "energyCells": 265,
    "siliconCarbide": 74
  },
  "storage_ter_m_solid_01_macro": {
    "computronicSubstrate": 24,
    "energyCells": 178,
    "siliconCarbide": 50
  },
  "storage_ter_s_solid_01_macro": {
    "computronicSubstrate": 14,
    "energyCells": 103,
    "siliconCarbide": 29
  },
  "hab_pir_l_01_macro": {
    "claytronics": 420,
    "energyCells": 383,
    "hullParts": 1729
  },
  "hab_pir_m_01_macro": {
    "claytronics": 297,
    "energyCells": 271,
    "hullParts": 1222
  },
  "hab_pir_s_01_macro": {
    "claytronics": 206,
    "energyCells": 188,
    "hullParts": 847
  },
  "storage_pir_l_condensate_01_macro": {
    "claytronics": 291,
    "energyCells": 265,
    "hullParts": 1198
  },
  "buildmodule_bor_ships_m_dockarea_01_macro": {
    "claytronics": 818,
    "energyCells": 8696,
    "hullParts": 2663,
    "water": 7875
  },
  "buildmodule_bor_ships_l_macro": {
    "claytronics": 1714,
    "energyCells": 18213,
    "hullParts": 5577,
    "water": 16495
  },
  "buildmodule_bor_ships_xl_macro": {
    "claytronics": 1744,
    "energyCells": 18526,
    "hullParts": 5673,
    "water": 16778
  },
  "struct_bor_base_01_macro": {
    "claytronics": 9,
    "energyCells": 275,
    "hullParts": 63,
    "water": 166
  },
  "struct_bor_base_02_macro": {
    "claytronics": 11,
    "energyCells": 336,
    "hullParts": 77,
    "water": 203
  },
  "struct_bor_base_03_macro": {
    "claytronics": 11,
    "energyCells": 360,
    "hullParts": 83,
    "water": 217
  },
  "struct_bor_base_04_macro": {
    "claytronics": 12,
    "energyCells": 380,
    "hullParts": 87,
    "water": 230
  },
  "struct_bor_base_05_macro": {
    "claytronics": 13,
    "energyCells": 417,
    "hullParts": 96,
    "water": 252
  },
  "struct_bor_cross_01_macro": {
    "claytronics": 7,
    "energyCells": 238,
    "hullParts": 55,
    "water": 144
  },
  "struct_bor_cross_02_macro": {
    "claytronics": 9,
    "energyCells": 296,
    "hullParts": 68,
    "water": 179
  },
  "struct_bor_vertical_01_macro": {
    "claytronics": 6,
    "energyCells": 197,
    "hullParts": 45,
    "water": 119
  },
  "struct_bor_vertical_02_macro": {
    "claytronics": 8,
    "energyCells": 258,
    "hullParts": 59,
    "water": 156
  },
  "defence_bor_claim_01_macro": {
    "claytronics": 85,
    "energyCells": 2711,
    "hullParts": 623,
    "water": 1637
  },
  "defence_bor_disc_01_macro": {
    "claytronics": 61,
    "energyCells": 1940,
    "hullParts": 446,
    "water": 1172
  },
  "defence_bor_tube_01_macro": {
    "claytronics": 53,
    "energyCells": 1684,
    "hullParts": 387,
    "water": 1017
  },
  "dockarea_bor_m_station_01_standard_macro": {
    "claytronics": 52,
    "energyCells": 1647,
    "hullParts": 378,
    "water": 995
  },
  "buildmodule_bor_equip_m_dockarea_01_macro": {
    "claytronics": 595,
    "energyCells": 6322,
    "hullParts": 1936,
    "water": 5725
  },
  "buildmodule_bor_equip_l_macro": {
    "claytronics": 872,
    "energyCells": 9260,
    "hullParts": 2836,
    "water": 8387
  },
  "buildmodule_bor_equip_xl_macro": {
    "claytronics": 1125,
    "energyCells": 11958,
    "hullParts": 3662,
    "water": 10830
  },
  "hab_bor_l_01_macro": {
    "claytronics": 114,
    "energyCells": 3631,
    "hullParts": 834,
    "water": 2192
  },
  "hab_bor_m_01_macro": {
    "claytronics": 81,
    "energyCells": 2567,
    "hullParts": 590,
    "water": 1550
  },
  "hab_bor_s_01_macro": {
    "claytronics": 56,
    "energyCells": 1785,
    "hullParts": 410,
    "water": 1078
  },
  "pier_bor_harbor_01_macro": {
    "claytronics": 336,
    "energyCells": 10723,
    "hullParts": 2463,
    "water": 6474
  },
  "pier_bor_harbor_02_macro": {
    "claytronics": 194,
    "energyCells": 6192,
    "hullParts": 1422,
    "water": 3738
  },
  "pier_bor_harbor_03_macro": {
    "claytronics": 388,
    "energyCells": 12371,
    "hullParts": 2841,
    "water": 7470
  },
  "pier_bor_harbor_04_macro": {
    "claytronics": 273,
    "energyCells": 8715,
    "hullParts": 2002,
    "water": 5262
  },
  "pier_bor_tradestation_01_macro": {
    "claytronics": 417,
    "energyCells": 13303,
    "hullParts": 3055,
    "water": 8032
  },
  "prod_bor_bofu_macro": {
    "claytronics": 163,
    "energyCells": 5190,
    "hullParts": 1192,
    "water": 3133
  },
  "prod_bor_bogas_macro": {
    "claytronics": 154,
    "energyCells": 4913,
    "hullParts": 1128,
    "water": 2966
  },
  "prod_bor_medicalsupplies_macro": {
    "claytronics": 140,
    "energyCells": 4453,
    "hullParts": 1023,
    "water": 2689
  },
  "prod_bor_plankton_macro": {
    "claytronics": 96,
    "energyCells": 3048,
    "hullParts": 700,
    "water": 1840
  },
  "storage_bor_l_container_01_macro": {
    "claytronics": 71,
    "energyCells": 2277,
    "hullParts": 523,
    "water": 1375
  },
  "storage_bor_m_container_01_macro": {
    "claytronics": 51,
    "energyCells": 1621,
    "hullParts": 372,
    "water": 979
  },
  "storage_bor_s_container_01_macro": {
    "claytronics": 32,
    "energyCells": 1027,
    "hullParts": 236,
    "water": 620
  },
  "storage_bor_l_liquid_01_macro": {
    "claytronics": 71,
    "energyCells": 2277,
    "hullParts": 523,
    "water": 1375
  },
  "storage_bor_m_liquid_01_macro": {
    "claytronics": 51,
    "energyCells": 1621,
    "hullParts": 372,
    "water": 979
  },
  "storage_bor_s_liquid_01_macro": {
    "claytronics": 32,
    "energyCells": 1027,
    "hullParts": 236,
    "water": 620
  },
  "storage_bor_l_solid_01_macro": {
    "claytronics": 71,
    "energyCells": 2277,
    "hullParts": 523,
    "water": 1375
  },
  "storage_bor_m_solid_01_macro": {
    "claytronics": 51,
    "energyCells": 1621,
    "hullParts": 372,
    "water": 979
  },
  "storage_bor_s_solid_01_macro": {
    "claytronics": 32,
    "energyCells": 1027,
    "hullParts": 236,
    "water": 620
  }
};

/**
 * Reverse lookup table from normalized friendly names to X4 macro names.
 */
export const NAME_TO_MACRO_DB = {
  "argon base connection structure 01": "struct_arg_base_01_macro",
  "argon base connection structure 02": "struct_arg_base_02_macro",
  "argon base connection structure 03": "struct_arg_base_03_macro",
  "argon cross connection structure 01": "struct_arg_cross_01_macro",
  "argon vertical connection structure 01": "struct_arg_vertical_01_macro",
  "argon vertical connection structure 02": "struct_arg_vertical_02_macro",
  "argon administrative centre": "defence_arg_claim_01_macro",
  "argon disc defence platform": "defence_arg_disc_01_macro",
  "argon bridge defence platform": "defence_arg_tube_01_macro",
  "1m6s standard dock area": "dockarea_arg_m_station_01_macro",
  "1m6s luxury dock area": "dockarea_arg_m_station_01_hightech_macro",
  "1m6s basic dock area": "dockarea_arg_m_station_01_lowtech_macro",
  "3m6s standard dock area": "dockarea_arg_m_station_02_macro",
  "3m6s luxury dock area": "dockarea_arg_m_station_02_hightech_macro",
  "3m6s basic dock area": "dockarea_arg_m_station_02_lowtech_macro",
  "8m standard dock area": "dockarea_arg_m_02_tradestation_01_macro",
  "argon l habitat": "hab_arg_l_01_macro",
  "argon m habitat": "hab_arg_m_01_macro",
  "argon s habitat": "hab_arg_s_01_macro",
  "argon 3-dock t pier": "pier_arg_harbor_01_macro",
  "argon 1-dock pier": "pier_arg_harbor_02_macro",
  "argon 3-dock e pier": "pier_arg_harbor_03_macro",
  "food ration production": "prod_arg_foodrations_macro",
  "meat production": "prod_arg_meat_macro",
  "argon medical supply production": "prod_arg_medicalsupplies_macro",
  "spacefuel production": "prod_arg_spacefuel_macro",
  "wheat production": "prod_arg_wheat_macro",
  "argon l container storage": "storage_arg_l_container_01_macro",
  "argon m container storage": "storage_arg_m_container_01_macro",
  "argon s container storage": "storage_arg_s_container_01_macro",
  "argon l liquid storage": "storage_arg_l_liquid_01_macro",
  "argon m liquid storage": "storage_arg_m_liquid_01_macro",
  "argon s liquid storage": "storage_arg_s_liquid_01_macro",
  "argon l solid storage": "storage_arg_l_solid_01_macro",
  "argon m solid storage": "storage_arg_m_solid_01_macro",
  "argon s solid storage": "storage_arg_s_solid_01_macro",
  "s/m ship fabrication bay": "buildmodule_gen_ships_m_dockarea_01_macro",
  "l ship fabrication bay": "buildmodule_gen_ships_l_macro",
  "xl ship fabrication bay": "buildmodule_gen_ships_xl_macro",
  "s/m ship maintenance bay": "buildmodule_gen_equip_m_dockarea_01_macro",
  "l ship maintenance bay": "buildmodule_gen_equip_l_macro",
  "xl ship maintenance bay": "buildmodule_gen_equip_xl_macro",
  "scrap processor": "proc_gen_scrapworks_macro",
  "advanced composite production": "prod_gen_advancedcomposites_macro",
  "advanced electronics production": "prod_gen_advancedelectronics_macro",
  "antimatter cell production": "prod_gen_antimattercells_macro",
  "antimatter converter production": "prod_gen_antimatterconverters_macro",
  "claytronics production": "prod_gen_claytronics_macro",
  "drone component production": "prod_gen_dronecomponents_macro",
  "energy cell production": "prod_gen_energycells_macro",
  "engine part production": "prod_gen_engineparts_macro",
  "field coil production": "prod_gen_fieldcoils_macro",
  "graphene production": "prod_gen_graphene_macro",
  "hull part production": "prod_gen_hullparts_macro",
  "microchip production": "prod_gen_microchips_macro",
  "missile component production": "prod_gen_missilecomponents_macro",
  "plasma conductor production": "prod_gen_plasmaconductors_macro",
  "quantum tube production": "prod_gen_quantumtubes_macro",
  "refined metal production": "prod_gen_refinedmetals_macro",
  "scanning array production": "prod_gen_scanningarrays_macro",
  "scrap recycler": "prod_gen_scrap_recycler_macro",
  "shield component production": "prod_gen_shieldcomponents_macro",
  "silicon wafer production": "prod_gen_siliconwafers_macro",
  "smart chip production": "prod_gen_smartchips_macro",
  "spice production": "prod_gen_spices_macro",
  "superfluid coolant production": "prod_gen_superfluidcoolant_macro",
  "turret component production": "prod_gen_turretcomponents_macro",
  "water production": "prod_gen_water_macro",
  "weapon component production": "prod_gen_weaponcomponents_macro",
  "paranid base connection structure 01": "struct_par_base_01_macro",
  "paranid base connection structure 02": "struct_par_base_02_macro",
  "paranid base connection structure 03": "struct_par_base_03_macro",
  "paranid cross connection structure 01": "struct_par_cross_01_macro",
  "paranid cross connection structure 02": "struct_par_cross_02_macro",
  "paranid cross connection structure 03": "struct_par_cross_03_macro",
  "paranid vertical connection structure 01": "struct_par_vertical_01_macro",
  "paranid vertical connection structure 02": "struct_par_vertical_02_macro",
  "paranid administrative centre": "defence_par_claim_01_macro",
  "paranid disc defence platform": "defence_par_disc_01_macro",
  "paranid bridge defence platform": "defence_par_tube_01_macro",
  "paranid l dome": "hab_par_l_01_macro",
  "paranid m dome": "hab_par_m_01_macro",
  "paranid s dome": "hab_par_s_01_macro",
  "paranid 3-dock t pier": "pier_par_harbor_01_macro",
  "paranid 1-dock pier": "pier_par_harbor_02_macro",
  "paranid 3-dock e pier": "pier_par_harbor_03_macro",
  "maja dust production": "prod_par_majadust_macro",
  "maja snail production": "prod_par_majasnails_macro",
  "paranid medical supply production": "prod_par_medicalsupplies_macro",
  "soja bean production": "prod_par_sojabeans_macro",
  "soja husk production": "prod_par_sojahusk_macro",
  "paranid l container storage": "storage_par_l_container_01_macro",
  "paranid m container storage": "storage_par_m_container_01_macro",
  "paranid s container storage": "storage_par_s_container_01_macro",
  "paranid l liquid storage": "storage_par_l_liquid_01_macro",
  "paranid m liquid storage": "storage_par_m_liquid_01_macro",
  "paranid s liquid storage": "storage_par_s_liquid_01_macro",
  "paranid l solid storage": "storage_par_l_solid_01_macro",
  "paranid m solid storage": "storage_par_m_solid_01_macro",
  "paranid s solid storage": "storage_par_s_solid_01_macro",
  "teladi base connection structure 01": "struct_tel_base_01_macro",
  "teladi base connection structure 02": "struct_tel_base_02_macro",
  "teladi base connection structure 03": "struct_tel_base_03_macro",
  "teladi cross connection structure 01": "struct_tel_cross_01_macro",
  "teladi vertical connection structure 01": "struct_tel_vertical_01_macro",
  "teladi vertical connection structure 02": "struct_tel_vertical_02_macro",
  "teladi administrative centre": "defence_tel_claim_01_macro",
  "teladi disc defence platform": "defence_tel_disc_01_macro",
  "teladi bridge defence platform": "defence_tel_tube_01_macro",
  "teladi l biome": "hab_tel_l_01_macro",
  "teladi m biome": "hab_tel_m_01_macro",
  "teladi s biome": "hab_tel_s_01_macro",
  "teladi 3-dock t pier": "pier_tel_harbor_01_macro",
  "teladi 1-dock pier": "pier_tel_harbor_02_macro",
  "teladi 3-dock e pier": "pier_tel_harbor_03_macro",
  "teladi advanced composite production": "prod_tel_advancedcomposites_macro",
  "teladi engine part production": "prod_tel_engineparts_macro",
  "teladi hull part production": "prod_tel_hullparts_macro",
  "teladi medical supply production": "prod_tel_medicalsupplies_macro",
  "nostrop oil production": "prod_tel_nostropoil_macro",
  "teladi scanning array production": "prod_tel_scanningarrays_macro",
  "spaceweed production": "prod_tel_spaceweed_macro",
  "sunrise flower production": "prod_tel_sunriseflowers_macro",
  "swamp plant production": "prod_tel_swampplants_macro",
  "teladianium production": "prod_tel_teladianium_macro",
  "teladi l container storage": "storage_tel_l_container_01_macro",
  "teladi m container storage": "storage_tel_m_container_01_macro",
  "teladi s container storage": "storage_tel_s_container_01_macro",
  "teladi l liquid storage": "storage_tel_l_liquid_01_macro",
  "teladi m liquid storage": "storage_tel_m_liquid_01_macro",
  "teladi s liquid storage": "storage_tel_s_liquid_01_macro",
  "teladi l solid storage": "storage_tel_l_solid_01_macro",
  "teladi m solid storage": "storage_tel_m_solid_01_macro",
  "teladi s solid storage": "storage_tel_s_solid_01_macro",
  "split base connection structure 01": "struct_spl_base_01_macro",
  "split base connection structure 02": "struct_spl_base_02_macro",
  "split base connection structure 03": "struct_spl_base_03_macro",
  "split cross connection structure 01": "struct_spl_cross_01_macro",
  "split vertical connection structure 01": "struct_spl_vertical_01_macro",
  "split vertical connection structure 02": "struct_spl_vertical_02_macro",
  "split administrative centre": "defence_spl_claim_01_macro",
  "split disc defence platform": "defence_spl_disc_01_macro",
  "split bridge defence platform": "defence_spl_tube_01_macro",
  "split l parlour": "hab_spl_l_01_macro",
  "split m parlour": "hab_spl_m_01_macro",
  "split s parlour": "hab_spl_s_01_macro",
  "split 4-dock t pier": "pier_spl_harbor_01_macro",
  "split 1-dock pier": "pier_spl_harbor_02_macro",
  "split 3-dock e pier": "pier_spl_harbor_03_macro",
  "chelt production": "prod_spl_cheltmeat_macro",
  "split medical supply production": "prod_spl_medicalsupplies_macro",
  "scruffin production": "prod_spl_scruffinfruit_macro",
  "split l container storage": "storage_spl_l_container_01_macro",
  "split m container storage": "storage_spl_m_container_01_macro",
  "split s container storage": "storage_spl_s_container_01_macro",
  "split l liquid storage": "storage_spl_l_liquid_01_macro",
  "split m liquid storage": "storage_spl_m_liquid_01_macro",
  "split s liquid storage": "storage_spl_s_liquid_01_macro",
  "split l solid storage": "storage_spl_l_solid_01_macro",
  "split m solid storage": "storage_spl_m_solid_01_macro",
  "split s solid storage": "storage_spl_s_solid_01_macro",
  "terran s/m ship fabrication bay": "buildmodule_ter_ships_m_dockarea_01_macro",
  "terran l ship fabrication bay": "buildmodule_ter_ships_l_macro",
  "terran xl ship fabrication bay": "buildmodule_ter_ships_xl_macro",
  "terran base connection structure 01": "struct_ter_base_01_macro",
  "terran base connection structure 02": "struct_ter_base_02_macro",
  "terran base connection structure 03": "struct_ter_base_03_macro",
  "terran cross connection structure 01": "struct_ter_cross_01_macro",
  "terran vertical connection structure 01": "struct_ter_vertical_01_macro",
  "terran vertical connection structure 02": "struct_ter_vertical_02_macro",
  "terran administrative centre": "defence_ter_claim_01_macro",
  "terran disc defence platform": "defence_ter_disc_01_macro",
  "terran bridge defence platform": "defence_ter_tube_01_macro",
  "terran 4m10s luxury dock area": "dockarea_ter_m_station_01_hightech_macro",
  "terran s/m ship maintenance bay": "buildmodule_ter_equip_m_dockarea_01_macro",
  "terran l ship maintenance bay": "buildmodule_ter_equip_l_macro",
  "terran xl ship maintenance bay": "buildmodule_ter_equip_xl_macro",
  "terran l living quarters": "hab_ter_l_01_macro",
  "terran m living quarters": "hab_ter_m_01_macro",
  "terran s living quarters": "hab_ter_s_01_macro",
  "terran 3-dock t pier": "pier_ter_harbor_01_macro",
  "terran 1-dock pier": "pier_ter_harbor_02_macro",
  "terran 3-dock e pier": "pier_ter_harbor_03_macro",
  "terran 4-dock t pier": "pier_ter_harbor_04_macro",
  "terran trading station hexa-dock pier": "pier_ter_tradestation_01_macro",
  "computronic substrate production": "prod_ter_computronicsubstrate_macro",
  "terran energy cell production": "prod_ter_energycells_macro",
  "terran medical supply production": "prod_ter_medicalsupplies_macro",
  "metallic microlattice production": "prod_ter_metallicmicrolattice_macro",
  "protein paste production": "prod_ter_proteinpaste_macro",
  "terran scrap recycler": "prod_ter_scrap_recycler_macro",
  "silicon carbide production": "prod_ter_siliconcarbide_macro",
  "stimulant production": "prod_ter_stimulants_macro",
  "terran mre production": "prod_ter_mre_macro",
  "terran l container storage": "storage_ter_l_container_01_macro",
  "terran m container storage": "storage_ter_m_container_01_macro",
  "terran s container storage": "storage_ter_s_container_01_macro",
  "terran l liquid storage": "storage_ter_l_liquid_01_macro",
  "terran m liquid storage": "storage_ter_m_liquid_01_macro",
  "terran s liquid storage": "storage_ter_s_liquid_01_macro",
  "terran l solid storage": "storage_ter_l_solid_01_macro",
  "terran m solid storage": "storage_ter_m_solid_01_macro",
  "terran s solid storage": "storage_ter_s_solid_01_macro",
  "argon l dormitory": "hab_pir_l_01_macro",
  "argon m dormitory": "hab_pir_m_01_macro",
  "argon s dormitory": "hab_pir_s_01_macro",
  "protectyon shield generator": "storage_pir_l_condensate_01_macro",
  "boron s/m ship fabrication bay": "buildmodule_bor_ships_m_dockarea_01_macro",
  "boron l ship fabrication bay": "buildmodule_bor_ships_l_macro",
  "boron xl ship fabrication bay": "buildmodule_bor_ships_xl_macro",
  "boron base connection structure 01": "struct_bor_base_01_macro",
  "boron base connection structure 02": "struct_bor_base_02_macro",
  "boron base connection structure 03": "struct_bor_base_03_macro",
  "boron base connection structure 04": "struct_bor_base_04_macro",
  "boron base connection structure 05": "struct_bor_base_05_macro",
  "boron cross connection structure 01": "struct_bor_cross_01_macro",
  "boron cross connection structure 02": "struct_bor_cross_02_macro",
  "boron vertical connection structure 01": "struct_bor_vertical_01_macro",
  "boron vertical connection structure 02": "struct_bor_vertical_02_macro",
  "boron administrative centre": "defence_bor_claim_01_macro",
  "boron disc defence platform": "defence_bor_disc_01_macro",
  "boron bridge defence platform": "defence_bor_tube_01_macro",
  "boron 4m14s luxury dock area": "dockarea_bor_m_station_01_standard_macro",
  "boron s/m ship maintenance bay": "buildmodule_bor_equip_m_dockarea_01_macro",
  "boron l ship maintenance bay": "buildmodule_bor_equip_l_macro",
  "boron xl ship maintenance bay": "buildmodule_bor_equip_xl_macro",
  "boron l oasis": "hab_bor_l_01_macro",
  "boron m oasis": "hab_bor_m_01_macro",
  "boron s oasis": "hab_bor_s_01_macro",
  "boron 4-dock t pier": "pier_bor_harbor_01_macro",
  "boron 1-dock pier": "pier_bor_harbor_02_macro",
  "boron 3-dock e pier": "pier_bor_harbor_03_macro",
  "boron trading station 4-dock pier": "pier_bor_harbor_04_macro",
  "boron trading station hexa-dock pier": "pier_bor_tradestation_01_macro",
  "bofu production": "prod_bor_bofu_macro",
  "bogas production": "prod_bor_bogas_macro",
  "boron medical supply production": "prod_bor_medicalsupplies_macro",
  "plankton production": "prod_bor_plankton_macro",
  "boron l container storage": "storage_bor_l_container_01_macro",
  "boron m container storage": "storage_bor_m_container_01_macro",
  "boron s container storage": "storage_bor_s_container_01_macro",
  "boron l liquid storage": "storage_bor_l_liquid_01_macro",
  "boron m liquid storage": "storage_bor_m_liquid_01_macro",
  "boron s liquid storage": "storage_bor_s_liquid_01_macro",
  "boron l solid storage": "storage_bor_l_solid_01_macro",
  "boron m solid storage": "storage_bor_m_solid_01_macro",
  "boron s solid storage": "storage_bor_s_solid_01_macro"
};

/**
 * Display name table from X4 macro names to human-readable module labels.
 */
export const MACRO_TO_NAME_DB = {
  "struct_arg_base_01_macro": "Argon Base Connection Structure 01",
  "struct_arg_base_02_macro": "Argon Base Connection Structure 02",
  "struct_arg_base_03_macro": "Argon Base Connection Structure 03",
  "struct_arg_cross_01_macro": "Argon Cross Connection Structure 01",
  "struct_arg_vertical_01_macro": "Argon Vertical Connection Structure 01",
  "struct_arg_vertical_02_macro": "Argon Vertical Connection Structure 02",
  "defence_arg_claim_01_macro": "Argon Administrative Centre",
  "defence_arg_disc_01_macro": "Argon Disc Defence Platform",
  "defence_arg_tube_01_macro": "Argon Bridge Defence Platform",
  "dockarea_arg_m_station_01_macro": "1M6S Standard Dock Area",
  "dockarea_arg_m_station_01_hightech_macro": "1M6S Luxury Dock Area",
  "dockarea_arg_m_station_01_lowtech_macro": "1M6S Basic Dock Area",
  "dockarea_arg_m_station_02_macro": "3M6S Standard Dock Area",
  "dockarea_arg_m_station_02_hightech_macro": "3M6S Luxury Dock Area",
  "dockarea_arg_m_station_02_lowtech_macro": "3M6S Basic Dock Area",
  "dockarea_arg_m_02_tradestation_01_macro": "8M Standard Dock Area",
  "hab_arg_l_01_macro": "Argon L Habitat",
  "hab_arg_m_01_macro": "Argon M Habitat",
  "hab_arg_s_01_macro": "Argon S Habitat",
  "pier_arg_harbor_01_macro": "Argon 3-Dock T Pier",
  "pier_arg_harbor_02_macro": "Argon 1-Dock Pier",
  "pier_arg_harbor_03_macro": "Argon 3-Dock E Pier",
  "prod_arg_foodrations_macro": "Food Ration Production",
  "prod_arg_meat_macro": "Meat Production",
  "prod_arg_medicalsupplies_macro": "Argon Medical Supply Production",
  "prod_arg_spacefuel_macro": "Spacefuel Production",
  "prod_arg_wheat_macro": "Wheat Production",
  "storage_arg_l_container_01_macro": "Argon L Container Storage",
  "storage_arg_m_container_01_macro": "Argon M Container Storage",
  "storage_arg_s_container_01_macro": "Argon S Container Storage",
  "storage_arg_l_liquid_01_macro": "Argon L Liquid Storage",
  "storage_arg_m_liquid_01_macro": "Argon M Liquid Storage",
  "storage_arg_s_liquid_01_macro": "Argon S Liquid Storage",
  "storage_arg_l_solid_01_macro": "Argon L Solid Storage",
  "storage_arg_m_solid_01_macro": "Argon M Solid Storage",
  "storage_arg_s_solid_01_macro": "Argon S Solid Storage",
  "buildmodule_gen_ships_m_dockarea_01_macro": "S/M Ship Fabrication Bay",
  "buildmodule_gen_ships_l_macro": "L Ship Fabrication Bay",
  "buildmodule_gen_ships_xl_macro": "XL Ship Fabrication Bay",
  "buildmodule_gen_equip_m_dockarea_01_macro": "S/M Ship Maintenance Bay",
  "buildmodule_gen_equip_l_macro": "L Ship Maintenance Bay",
  "buildmodule_gen_equip_xl_macro": "XL Ship Maintenance Bay",
  "proc_gen_scrapworks_macro": "Scrap Processor",
  "prod_gen_advancedcomposites_macro": "Advanced Composite Production",
  "prod_gen_advancedelectronics_macro": "Advanced Electronics Production",
  "prod_gen_antimattercells_macro": "Antimatter Cell Production",
  "prod_gen_antimatterconverters_macro": "Antimatter Converter Production",
  "prod_gen_claytronics_macro": "Claytronics Production",
  "prod_gen_dronecomponents_macro": "Drone Component Production",
  "prod_gen_energycells_macro": "Energy Cell Production",
  "prod_gen_engineparts_macro": "Engine Part Production",
  "prod_gen_fieldcoils_macro": "Field Coil Production",
  "prod_gen_graphene_macro": "Graphene Production",
  "prod_gen_hullparts_macro": "Hull Part Production",
  "prod_gen_microchips_macro": "Microchip Production",
  "prod_gen_missilecomponents_macro": "Missile Component Production",
  "prod_gen_plasmaconductors_macro": "Plasma Conductor Production",
  "prod_gen_quantumtubes_macro": "Quantum Tube Production",
  "prod_gen_refinedmetals_macro": "Refined Metal Production",
  "prod_gen_scanningarrays_macro": "Scanning Array Production",
  "prod_gen_scrap_recycler_macro": "Scrap Recycler",
  "prod_gen_shieldcomponents_macro": "Shield Component Production",
  "prod_gen_siliconwafers_macro": "Silicon Wafer Production",
  "prod_gen_smartchips_macro": "Smart Chip Production",
  "prod_gen_spices_macro": "Spice Production",
  "prod_gen_superfluidcoolant_macro": "Superfluid Coolant Production",
  "prod_gen_turretcomponents_macro": "Turret Component Production",
  "prod_gen_water_macro": "Water Production",
  "prod_gen_weaponcomponents_macro": "Weapon Component Production",
  "struct_par_base_01_macro": "Paranid Base Connection Structure 01",
  "struct_par_base_02_macro": "Paranid Base Connection Structure 02",
  "struct_par_base_03_macro": "Paranid Base Connection Structure 03",
  "struct_par_cross_01_macro": "Paranid Cross Connection Structure 01",
  "struct_par_cross_02_macro": "Paranid Cross Connection Structure 02",
  "struct_par_cross_03_macro": "Paranid Cross Connection Structure 03",
  "struct_par_vertical_01_macro": "Paranid Vertical Connection Structure 01",
  "struct_par_vertical_02_macro": "Paranid Vertical Connection Structure 02",
  "defence_par_claim_01_macro": "Paranid Administrative Centre",
  "defence_par_disc_01_macro": "Paranid Disc Defence Platform",
  "defence_par_tube_01_macro": "Paranid Bridge Defence Platform",
  "hab_par_l_01_macro": "Paranid L Dome",
  "hab_par_m_01_macro": "Paranid M Dome",
  "hab_par_s_01_macro": "Paranid S Dome",
  "pier_par_harbor_01_macro": "Paranid 3-Dock T Pier",
  "pier_par_harbor_02_macro": "Paranid 1-Dock Pier",
  "pier_par_harbor_03_macro": "Paranid 3-Dock E Pier",
  "prod_par_majadust_macro": "Maja Dust Production",
  "prod_par_majasnails_macro": "Maja Snail Production",
  "prod_par_medicalsupplies_macro": "Paranid Medical Supply Production",
  "prod_par_sojabeans_macro": "Soja Bean Production",
  "prod_par_sojahusk_macro": "Soja Husk Production",
  "storage_par_l_container_01_macro": "Paranid L Container Storage",
  "storage_par_m_container_01_macro": "Paranid M Container Storage",
  "storage_par_s_container_01_macro": "Paranid S Container Storage",
  "storage_par_l_liquid_01_macro": "Paranid L Liquid Storage",
  "storage_par_m_liquid_01_macro": "Paranid M Liquid Storage",
  "storage_par_s_liquid_01_macro": "Paranid S Liquid Storage",
  "storage_par_l_solid_01_macro": "Paranid L Solid Storage",
  "storage_par_m_solid_01_macro": "Paranid M Solid Storage",
  "storage_par_s_solid_01_macro": "Paranid S Solid Storage",
  "struct_tel_base_01_macro": "Teladi Base Connection Structure 01",
  "struct_tel_base_02_macro": "Teladi Base Connection Structure 02",
  "struct_tel_base_03_macro": "Teladi Base Connection Structure 03",
  "struct_tel_cross_01_macro": "Teladi Cross Connection Structure 01",
  "struct_tel_vertical_01_macro": "Teladi Vertical Connection Structure 01",
  "struct_tel_vertical_02_macro": "Teladi Vertical Connection Structure 02",
  "defence_tel_claim_01_macro": "Teladi Administrative Centre",
  "defence_tel_disc_01_macro": "Teladi Disc Defence Platform",
  "defence_tel_tube_01_macro": "Teladi Bridge Defence Platform",
  "hab_tel_l_01_macro": "Teladi L Biome",
  "hab_tel_m_01_macro": "Teladi M Biome",
  "hab_tel_s_01_macro": "Teladi S Biome",
  "pier_tel_harbor_01_macro": "Teladi 3-Dock T Pier",
  "pier_tel_harbor_02_macro": "Teladi 1-Dock Pier",
  "pier_tel_harbor_03_macro": "Teladi 3-Dock E Pier",
  "prod_tel_advancedcomposites_macro": "Teladi Advanced Composite Production",
  "prod_tel_engineparts_macro": "Teladi Engine Part Production",
  "prod_tel_hullparts_macro": "Teladi Hull Part Production",
  "prod_tel_medicalsupplies_macro": "Teladi Medical Supply Production",
  "prod_tel_nostropoil_macro": "Nostrop Oil Production",
  "prod_tel_scanningarrays_macro": "Teladi Scanning Array Production",
  "prod_tel_spaceweed_macro": "Spaceweed Production",
  "prod_tel_sunriseflowers_macro": "Sunrise Flower Production",
  "prod_tel_swampplants_macro": "Swamp Plant Production",
  "prod_tel_teladianium_macro": "Teladianium Production",
  "storage_tel_l_container_01_macro": "Teladi L Container Storage",
  "storage_tel_m_container_01_macro": "Teladi M Container Storage",
  "storage_tel_s_container_01_macro": "Teladi S Container Storage",
  "storage_tel_l_liquid_01_macro": "Teladi L Liquid Storage",
  "storage_tel_m_liquid_01_macro": "Teladi M Liquid Storage",
  "storage_tel_s_liquid_01_macro": "Teladi S Liquid Storage",
  "storage_tel_l_solid_01_macro": "Teladi L Solid Storage",
  "storage_tel_m_solid_01_macro": "Teladi M Solid Storage",
  "storage_tel_s_solid_01_macro": "Teladi S Solid Storage",
  "struct_spl_base_01_macro": "Split Base Connection Structure 01",
  "struct_spl_base_02_macro": "Split Base Connection Structure 02",
  "struct_spl_base_03_macro": "Split Base Connection Structure 03",
  "struct_spl_cross_01_macro": "Split Cross Connection Structure 01",
  "struct_spl_vertical_01_macro": "Split Vertical Connection Structure 01",
  "struct_spl_vertical_02_macro": "Split Vertical Connection Structure 02",
  "defence_spl_claim_01_macro": "Split Administrative Centre",
  "defence_spl_disc_01_macro": "Split Disc Defence Platform",
  "defence_spl_tube_01_macro": "Split Bridge Defence Platform",
  "hab_spl_l_01_macro": "Split L Parlour",
  "hab_spl_m_01_macro": "Split M Parlour",
  "hab_spl_s_01_macro": "Split S Parlour",
  "pier_spl_harbor_01_macro": "Split 4-Dock T Pier",
  "pier_spl_harbor_02_macro": "Split 1-Dock Pier",
  "pier_spl_harbor_03_macro": "Split 3-Dock E Pier",
  "prod_spl_cheltmeat_macro": "Chelt Production",
  "prod_spl_medicalsupplies_macro": "Split Medical Supply Production",
  "prod_spl_scruffinfruit_macro": "Scruffin Production",
  "storage_spl_l_container_01_macro": "Split L Container Storage",
  "storage_spl_m_container_01_macro": "Split M Container Storage",
  "storage_spl_s_container_01_macro": "Split S Container Storage",
  "storage_spl_l_liquid_01_macro": "Split L Liquid Storage",
  "storage_spl_m_liquid_01_macro": "Split M Liquid Storage",
  "storage_spl_s_liquid_01_macro": "Split S Liquid Storage",
  "storage_spl_l_solid_01_macro": "Split L Solid Storage",
  "storage_spl_m_solid_01_macro": "Split M Solid Storage",
  "storage_spl_s_solid_01_macro": "Split S Solid Storage",
  "buildmodule_ter_ships_m_dockarea_01_macro": "Terran S/M Ship Fabrication Bay",
  "buildmodule_ter_ships_l_macro": "Terran L Ship Fabrication Bay",
  "buildmodule_ter_ships_xl_macro": "Terran XL Ship Fabrication Bay",
  "struct_ter_base_01_macro": "Terran Base Connection Structure 01",
  "struct_ter_base_02_macro": "Terran Base Connection Structure 02",
  "struct_ter_base_03_macro": "Terran Base Connection Structure 03",
  "struct_ter_cross_01_macro": "Terran Cross Connection Structure 01",
  "struct_ter_vertical_01_macro": "Terran Vertical Connection Structure 01",
  "struct_ter_vertical_02_macro": "Terran Vertical Connection Structure 02",
  "defence_ter_claim_01_macro": "Terran Administrative Centre",
  "defence_ter_disc_01_macro": "Terran Disc Defence Platform",
  "defence_ter_tube_01_macro": "Terran Bridge Defence Platform",
  "dockarea_ter_m_station_01_hightech_macro": "Terran 4M10S Luxury Dock Area",
  "buildmodule_ter_equip_m_dockarea_01_macro": "Terran S/M Ship Maintenance Bay",
  "buildmodule_ter_equip_l_macro": "Terran L Ship Maintenance Bay",
  "buildmodule_ter_equip_xl_macro": "Terran XL Ship Maintenance Bay",
  "hab_ter_l_01_macro": "Terran L Living Quarters",
  "hab_ter_m_01_macro": "Terran M Living Quarters",
  "hab_ter_s_01_macro": "Terran S Living Quarters",
  "pier_ter_harbor_01_macro": "Terran 3-Dock T Pier",
  "pier_ter_harbor_02_macro": "Terran 1-Dock Pier",
  "pier_ter_harbor_03_macro": "Terran 3-Dock E Pier",
  "pier_ter_harbor_04_macro": "Terran 4-Dock T Pier",
  "pier_ter_tradestation_01_macro": "Terran Trading Station Hexa-Dock Pier",
  "prod_ter_computronicsubstrate_macro": "Computronic Substrate Production",
  "prod_ter_energycells_macro": "Terran Energy Cell Production",
  "prod_ter_medicalsupplies_macro": "Terran Medical Supply Production",
  "prod_ter_metallicmicrolattice_macro": "Metallic Microlattice Production",
  "prod_ter_proteinpaste_macro": "Protein Paste Production",
  "prod_ter_scrap_recycler_macro": "Terran Scrap Recycler",
  "prod_ter_siliconcarbide_macro": "Silicon Carbide Production",
  "prod_ter_stimulants_macro": "Stimulant Production",
  "prod_ter_mre_macro": "Terran MRE Production",
  "storage_ter_l_container_01_macro": "Terran L Container Storage",
  "storage_ter_m_container_01_macro": "Terran M Container Storage",
  "storage_ter_s_container_01_macro": "Terran S Container Storage",
  "storage_ter_l_liquid_01_macro": "Terran L Liquid Storage",
  "storage_ter_m_liquid_01_macro": "Terran M Liquid Storage",
  "storage_ter_s_liquid_01_macro": "Terran S Liquid Storage",
  "storage_ter_l_solid_01_macro": "Terran L Solid Storage",
  "storage_ter_m_solid_01_macro": "Terran M Solid Storage",
  "storage_ter_s_solid_01_macro": "Terran S Solid Storage",
  "hab_pir_l_01_macro": "Argon L Dormitory",
  "hab_pir_m_01_macro": "Argon M Dormitory",
  "hab_pir_s_01_macro": "Argon S Dormitory",
  "storage_pir_l_condensate_01_macro": "Protectyon Shield Generator",
  "buildmodule_bor_ships_m_dockarea_01_macro": "Boron S/M Ship Fabrication Bay",
  "buildmodule_bor_ships_l_macro": "Boron L Ship Fabrication Bay",
  "buildmodule_bor_ships_xl_macro": "Boron XL Ship Fabrication Bay",
  "struct_bor_base_01_macro": "Boron Base Connection Structure 01",
  "struct_bor_base_02_macro": "Boron Base Connection Structure 02",
  "struct_bor_base_03_macro": "Boron Base Connection Structure 03",
  "struct_bor_base_04_macro": "Boron Base Connection Structure 04",
  "struct_bor_base_05_macro": "Boron Base Connection Structure 05",
  "struct_bor_cross_01_macro": "Boron Cross Connection Structure 01",
  "struct_bor_cross_02_macro": "Boron Cross Connection Structure 02",
  "struct_bor_vertical_01_macro": "Boron Vertical Connection Structure 01",
  "struct_bor_vertical_02_macro": "Boron Vertical Connection Structure 02",
  "defence_bor_claim_01_macro": "Boron Administrative Centre",
  "defence_bor_disc_01_macro": "Boron Disc Defence Platform",
  "defence_bor_tube_01_macro": "Boron Bridge Defence Platform",
  "dockarea_bor_m_station_01_standard_macro": "Boron 4M14S Luxury Dock Area",
  "buildmodule_bor_equip_m_dockarea_01_macro": "Boron S/M Ship Maintenance Bay",
  "buildmodule_bor_equip_l_macro": "Boron L Ship Maintenance Bay",
  "buildmodule_bor_equip_xl_macro": "Boron XL Ship Maintenance Bay",
  "hab_bor_l_01_macro": "Boron L Oasis",
  "hab_bor_m_01_macro": "Boron M Oasis",
  "hab_bor_s_01_macro": "Boron S Oasis",
  "pier_bor_harbor_01_macro": "Boron 4-Dock T Pier",
  "pier_bor_harbor_02_macro": "Boron 1-Dock Pier",
  "pier_bor_harbor_03_macro": "Boron 3-Dock E Pier",
  "pier_bor_harbor_04_macro": "Boron Trading Station 4-Dock Pier",
  "pier_bor_tradestation_01_macro": "Boron Trading Station Hexa-Dock Pier",
  "prod_bor_bofu_macro": "BoFu Production",
  "prod_bor_bogas_macro": "BoGas Production",
  "prod_bor_medicalsupplies_macro": "Boron Medical Supply Production",
  "prod_bor_plankton_macro": "Plankton Production",
  "storage_bor_l_container_01_macro": "Boron L Container Storage",
  "storage_bor_m_container_01_macro": "Boron M Container Storage",
  "storage_bor_s_container_01_macro": "Boron S Container Storage",
  "storage_bor_l_liquid_01_macro": "Boron L Liquid Storage",
  "storage_bor_m_liquid_01_macro": "Boron M Liquid Storage",
  "storage_bor_s_liquid_01_macro": "Boron S Liquid Storage",
  "storage_bor_l_solid_01_macro": "Boron L Solid Storage",
  "storage_bor_m_solid_01_macro": "Boron M Solid Storage",
  "storage_bor_s_solid_01_macro": "Boron S Solid Storage"
};
