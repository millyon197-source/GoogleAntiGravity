/**
 * Pre-loaded X4 Station Construction Plan XML samples.
 */

export const SAMPLES = {
  refineryComplex: `<?xml version="1.0" encoding="UTF-8"?>
<plans>
  <plan id="6E731F75-D302-42C5-B8CF-02E0BF2FBC43_1754199066" name="Methane Miner" description="Methane mining station">
    <entry index="1" macro="pier_arg_harbor_04_macro">
      <offset>
        <position x="-959.899" z="393.056"/>
      </offset>
    </entry>
    <entry index="2" macro="storage_arg_l_liquid_01_macro" connection="connectionsnap003">
      <predecessor index="1" connection="con_snap_01"/>
      <offset>
        <position x="-559.899" y="2.772" z="393.056"/>
      </offset>
    </entry>
    <entry index="3" macro="dockarea_arg_m_station_02_hightech_macro" connection="connectionsnap001">
      <predecessor index="2" connection="connectionsnap002"/>
      <offset>
        <position x="40.1" y="0.00014" z="393.055"/>
      </offset>
    </entry>
    <entry index="4" macro="defence_arg_tube_01_macro" connection="connectionsnap002">
      <predecessor index="2" connection="connectionsnap004"/>
      <offset>
        <position x="-559.9" z="-606.944"/>
      </offset>
    </entry>
    <entry index="5" macro="defence_arg_tube_01_macro" connection="connectionsnap001">
      <predecessor index="2" connection="connectionsnap001"/>
      <offset>
        <position x="-559.899" z="1393.056"/>
      </offset>
    </entry>
    <entry index="6" macro="defence_arg_disc_01_macro" connection="connectionsnap004">
      <predecessor index="3" connection="connectionsnap002"/>
      <offset>
        <position x="440.1" y="0.00014" z="393.055"/>
      </offset>
    </entry>
  </plan>
</plans>`,

  defenseFortress: `<?xml version="1.0" encoding="UTF-8"?>
<plans>
  <plan id="defense_fort_xenon_border" name="Xenon Border Defense Citadel" description="Heavy military fortress designed to secure gate choke-points. Features 1 Admin Center, 6 Defense discs with gun turrets, 1 Docking pier, storage for ammunition, and structural towers.">
    <!-- Administration Center -->
    <entry index="1" macro="struct_arg_base_01_macro">
      <position x="0" y="0" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    
    <!-- Dock Area -->
    <entry index="2" macro="dockarea_arg_l_station_01_macro">
      <position x="0" y="0" z="-140"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>

    <!-- Cross Hub and Ammo Storage -->
    <entry index="3" macro="struct_arg_cross_01_macro">
      <position x="0" y="0" z="120"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="4" macro="storage_arg_m_container_01_macro">
      <position x="0" y="100" z="120"/>
      <rotation yaw="0" pitch="90" roll="0"/>
    </entry>

    <!-- East Wing (Defense Tower 1) -->
    <entry index="5" macro="struct_arg_straight_02_macro">
      <position x="100" y="0" z="120"/>
      <rotation yaw="-90" pitch="0" roll="0"/>
    </entry>
    <entry index="6" macro="struct_arg_tower_01_macro">
      <position x="200" y="0" z="120"/>
      <rotation yaw="-90" pitch="0" roll="0"/>
    </entry>
    <entry index="7" macro="defense_arg_disc_01_macro">
      <position x="320" y="0" z="120"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="8" macro="defense_arg_disc_01_macro">
      <position x="200" y="0" z="240"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>

    <!-- West Wing (Defense Tower 2) -->
    <entry index="9" macro="struct_arg_straight_02_macro">
      <position x="-100" y="0" z="120"/>
      <rotation yaw="90" pitch="0" roll="0"/>
    </entry>
    <entry index="10" macro="struct_arg_tower_01_macro">
      <position x="-200" y="0" z="120"/>
      <rotation yaw="90" pitch="0" roll="0"/>
    </entry>
    <entry index="11" macro="defense_arg_disc_01_macro">
      <position x="-320" y="0" z="120"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="12" macro="defense_arg_disc_01_macro">
      <position x="-200" y="0" z="240"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>

    <!-- Top and Bottom Outer Defense Rings -->
    <entry index="13" macro="struct_arg_tower_01_macro">
      <position x="0" y="200" z="120"/>
      <rotation yaw="0" pitch="0" roll="90"/>
    </entry>
    <entry index="14" macro="defense_arg_disc_01_macro">
      <position x="0" y="320" z="120"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    
    <entry index="15" macro="struct_arg_tower_01_macro">
      <position x="0" y="-200" z="120"/>
      <rotation yaw="0" pitch="0" roll="-90"/>
    </entry>
    <entry index="16" macro="defense_arg_disc_01_macro">
      <position x="0" y="-320" z="120"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
  </plan>
</plans>`,

  allModulesPlan: `<?xml version="1.0" encoding="UTF-8"?>
<plans>
  <plan id="showcase_all_modules" name="All Modules Showcase" description="A vertical stack of all 247 modules, separated by their bounding boxes.">
    <entry index="1" macro="struct_arg_base_01_macro">
      <position x="0" y="15" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="2" macro="struct_arg_base_02_macro">
      <position x="0" y="95" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="3" macro="struct_arg_base_03_macro">
      <position x="0" y="175" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="4" macro="struct_arg_cross_01_macro">
      <position x="0" y="306" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="5" macro="struct_arg_vertical_01_macro">
      <position x="0" y="403" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="6" macro="struct_arg_vertical_02_macro">
      <position x="0" y="483" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="7" macro="defence_arg_claim_01_macro">
      <position x="0" y="563" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="8" macro="defence_arg_disc_01_macro">
      <position x="0" y="808" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="9" macro="defence_arg_tube_01_macro">
      <position x="0" y="943" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="10" macro="dockarea_arg_m_station_01_macro">
      <position x="0" y="1064" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="11" macro="dockarea_arg_m_station_01_hightech_macro">
      <position x="0" y="1185" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="12" macro="dockarea_arg_m_station_01_lowtech_macro">
      <position x="0" y="1306" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="13" macro="dockarea_arg_m_station_02_macro">
      <position x="0" y="1427" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="14" macro="dockarea_arg_m_station_02_hightech_macro">
      <position x="0" y="1548" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="15" macro="dockarea_arg_m_station_02_lowtech_macro">
      <position x="0" y="1670" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="16" macro="dockarea_arg_m_02_tradestation_01_macro">
      <position x="0" y="1791" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="17" macro="hab_arg_l_01_macro">
      <position x="0" y="2255" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="18" macro="hab_arg_m_01_macro">
      <position x="0" y="2554" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="19" macro="hab_arg_s_01_macro">
      <position x="0" y="2785" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="20" macro="pier_arg_harbor_01_macro">
      <position x="0" y="2927" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="21" macro="pier_arg_harbor_02_macro">
      <position x="0" y="3032" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="22" macro="pier_arg_harbor_03_macro">
      <position x="0" y="3138" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="23" macro="prod_arg_foodrations_macro">
      <position x="0" y="3265" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="24" macro="prod_arg_meat_macro">
      <position x="0" y="3382" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="25" macro="prod_arg_medicalsupplies_macro">
      <position x="0" y="3499" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="26" macro="prod_arg_spacefuel_macro">
      <position x="0" y="3617" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="27" macro="prod_arg_wheat_macro">
      <position x="0" y="3734" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="28" macro="storage_arg_l_container_01_macro">
      <position x="0" y="3970" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="29" macro="storage_arg_m_container_01_macro">
      <position x="0" y="4215" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="30" macro="storage_arg_s_container_01_macro">
      <position x="0" y="4411" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="31" macro="storage_arg_l_liquid_01_macro">
      <position x="0" y="4656" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="32" macro="storage_arg_m_liquid_01_macro">
      <position x="0" y="4901" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="33" macro="storage_arg_s_liquid_01_macro">
      <position x="0" y="5098" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="34" macro="storage_arg_l_solid_01_macro">
      <position x="0" y="5342" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="35" macro="storage_arg_m_solid_01_macro">
      <position x="0" y="5587" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="36" macro="storage_arg_s_solid_01_macro">
      <position x="0" y="5784" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="37" macro="buildmodule_gen_ships_m_dockarea_01_macro">
      <position x="0" y="5929" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="38" macro="buildmodule_gen_ships_l_macro">
      <position x="0" y="6059" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="39" macro="buildmodule_gen_ships_xl_macro">
      <position x="0" y="6148" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="40" macro="buildmodule_gen_equip_m_dockarea_01_macro">
      <position x="0" y="6269" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="41" macro="buildmodule_gen_equip_l_macro">
      <position x="0" y="6399" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="42" macro="buildmodule_gen_equip_xl_macro">
      <position x="0" y="6488" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="43" macro="proc_gen_scrapworks_macro">
      <position x="0" y="6568" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="44" macro="prod_gen_advancedcomposites_macro">
      <position x="0" y="6694" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="45" macro="prod_gen_advancedelectronics_macro">
      <position x="0" y="6812" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="46" macro="prod_gen_antimattercells_macro">
      <position x="0" y="6929" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="47" macro="prod_gen_antimatterconverters_macro">
      <position x="0" y="7047" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="48" macro="prod_gen_claytronics_macro">
      <position x="0" y="7164" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="49" macro="prod_gen_dronecomponents_macro">
      <position x="0" y="7281" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="50" macro="prod_gen_energycells_macro">
      <position x="0" y="7399" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="51" macro="prod_gen_engineparts_macro">
      <position x="0" y="7516" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="52" macro="prod_gen_fieldcoils_macro">
      <position x="0" y="7634" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="53" macro="prod_gen_graphene_macro">
      <position x="0" y="7751" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="54" macro="prod_gen_hullparts_macro">
      <position x="0" y="7868" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="55" macro="prod_gen_microchips_macro">
      <position x="0" y="7986" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="56" macro="prod_gen_missilecomponents_macro">
      <position x="0" y="8103" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="57" macro="prod_gen_plasmaconductors_macro">
      <position x="0" y="8221" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="58" macro="prod_gen_quantumtubes_macro">
      <position x="0" y="8338" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="59" macro="prod_gen_refinedmetals_macro">
      <position x="0" y="8455" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="60" macro="prod_gen_scanningarrays_macro">
      <position x="0" y="8573" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="61" macro="prod_gen_scrap_recycler_macro">
      <position x="0" y="8690" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="62" macro="prod_gen_shieldcomponents_macro">
      <position x="0" y="8808" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="63" macro="prod_gen_siliconwafers_macro">
      <position x="0" y="8925" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="64" macro="prod_gen_smartchips_macro">
      <position x="0" y="9042" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="65" macro="prod_gen_spices_macro">
      <position x="0" y="9160" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="66" macro="prod_gen_superfluidcoolant_macro">
      <position x="0" y="9277" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="67" macro="prod_gen_turretcomponents_macro">
      <position x="0" y="9395" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="68" macro="prod_gen_water_macro">
      <position x="0" y="9512" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="69" macro="prod_gen_weaponcomponents_macro">
      <position x="0" y="9629" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="70" macro="struct_par_base_01_macro">
      <position x="0" y="9738" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="71" macro="struct_par_base_02_macro">
      <position x="0" y="9818" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="72" macro="struct_par_base_03_macro">
      <position x="0" y="9898" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="73" macro="struct_par_cross_01_macro">
      <position x="0" y="10029" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="74" macro="struct_par_cross_02_macro">
      <position x="0" y="10143" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="75" macro="struct_par_cross_03_macro">
      <position x="0" y="10257" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="76" macro="struct_par_vertical_01_macro">
      <position x="0" y="10354" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="77" macro="struct_par_vertical_02_macro">
      <position x="0" y="10434" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="78" macro="defence_par_claim_01_macro">
      <position x="0" y="10514" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="79" macro="defence_par_disc_01_macro">
      <position x="0" y="10759" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="80" macro="defence_par_tube_01_macro">
      <position x="0" y="10894" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="81" macro="hab_par_l_01_macro">
      <position x="0" y="11359" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="82" macro="hab_par_m_01_macro">
      <position x="0" y="11657" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="83" macro="hab_par_s_01_macro">
      <position x="0" y="11888" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="84" macro="pier_par_harbor_01_macro">
      <position x="0" y="12030" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="85" macro="pier_par_harbor_02_macro">
      <position x="0" y="12136" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="86" macro="pier_par_harbor_03_macro">
      <position x="0" y="12241" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="87" macro="prod_par_majadust_macro">
      <position x="0" y="12368" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="88" macro="prod_par_majasnails_macro">
      <position x="0" y="12485" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="89" macro="prod_par_medicalsupplies_macro">
      <position x="0" y="12603" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="90" macro="prod_par_sojabeans_macro">
      <position x="0" y="12720" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="91" macro="prod_par_sojahusk_macro">
      <position x="0" y="12837" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="92" macro="storage_par_l_container_01_macro">
      <position x="0" y="13073" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="93" macro="storage_par_m_container_01_macro">
      <position x="0" y="13318" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="94" macro="storage_par_s_container_01_macro">
      <position x="0" y="13515" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="95" macro="storage_par_l_liquid_01_macro">
      <position x="0" y="13759" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="96" macro="storage_par_m_liquid_01_macro">
      <position x="0" y="14004" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="97" macro="storage_par_s_liquid_01_macro">
      <position x="0" y="14201" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="98" macro="storage_par_l_solid_01_macro">
      <position x="0" y="14445" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="99" macro="storage_par_m_solid_01_macro">
      <position x="0" y="14690" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="100" macro="storage_par_s_solid_01_macro">
      <position x="0" y="14887" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="101" macro="struct_tel_base_01_macro">
      <position x="0" y="15032" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="102" macro="struct_tel_base_02_macro">
      <position x="0" y="15112" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="103" macro="struct_tel_base_03_macro">
      <position x="0" y="15192" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="104" macro="struct_tel_cross_01_macro">
      <position x="0" y="15323" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="105" macro="struct_tel_vertical_01_macro">
      <position x="0" y="15420" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="106" macro="struct_tel_vertical_02_macro">
      <position x="0" y="15500" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="107" macro="defence_tel_claim_01_macro">
      <position x="0" y="15580" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="108" macro="defence_tel_disc_01_macro">
      <position x="0" y="15825" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="109" macro="defence_tel_tube_01_macro">
      <position x="0" y="15960" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="110" macro="hab_tel_l_01_macro">
      <position x="0" y="16425" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="111" macro="hab_tel_m_01_macro">
      <position x="0" y="16723" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="112" macro="hab_tel_s_01_macro">
      <position x="0" y="16954" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="113" macro="pier_tel_harbor_01_macro">
      <position x="0" y="17096" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="114" macro="pier_tel_harbor_02_macro">
      <position x="0" y="17202" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="115" macro="pier_tel_harbor_03_macro">
      <position x="0" y="17307" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="116" macro="prod_tel_advancedcomposites_macro">
      <position x="0" y="17434" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="117" macro="prod_tel_engineparts_macro">
      <position x="0" y="17551" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="118" macro="prod_tel_hullparts_macro">
      <position x="0" y="17669" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="119" macro="prod_tel_medicalsupplies_macro">
      <position x="0" y="17786" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="120" macro="prod_tel_nostropoil_macro">
      <position x="0" y="17903" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="121" macro="prod_tel_scanningarrays_macro">
      <position x="0" y="18021" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="122" macro="prod_tel_spaceweed_macro">
      <position x="0" y="18138" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="123" macro="prod_tel_sunriseflowers_macro">
      <position x="0" y="18256" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="124" macro="prod_tel_swampplants_macro">
      <position x="0" y="18373" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="125" macro="prod_tel_teladianium_macro">
      <position x="0" y="18490" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="126" macro="storage_tel_l_container_01_macro">
      <position x="0" y="18726" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="127" macro="storage_tel_m_container_01_macro">
      <position x="0" y="18971" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="128" macro="storage_tel_s_container_01_macro">
      <position x="0" y="19168" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="129" macro="storage_tel_l_liquid_01_macro">
      <position x="0" y="19412" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="130" macro="storage_tel_m_liquid_01_macro">
      <position x="0" y="19657" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="131" macro="storage_tel_s_liquid_01_macro">
      <position x="0" y="19854" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="132" macro="storage_tel_l_solid_01_macro">
      <position x="0" y="20098" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="133" macro="storage_tel_m_solid_01_macro">
      <position x="0" y="20343" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="134" macro="storage_tel_s_solid_01_macro">
      <position x="0" y="20540" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="135" macro="struct_spl_base_01_macro">
      <position x="0" y="20685" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="136" macro="struct_spl_base_02_macro">
      <position x="0" y="20765" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="137" macro="struct_spl_base_03_macro">
      <position x="0" y="20845" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="138" macro="struct_spl_cross_01_macro">
      <position x="0" y="20976" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="139" macro="struct_spl_vertical_01_macro">
      <position x="0" y="21073" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="140" macro="struct_spl_vertical_02_macro">
      <position x="0" y="21153" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="141" macro="defence_spl_claim_01_macro">
      <position x="0" y="21233" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="142" macro="defence_spl_disc_01_macro">
      <position x="0" y="21478" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="143" macro="defence_spl_tube_01_macro">
      <position x="0" y="21613" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="144" macro="hab_spl_l_01_macro">
      <position x="0" y="22078" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="145" macro="hab_spl_m_01_macro">
      <position x="0" y="22376" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="146" macro="hab_spl_s_01_macro">
      <position x="0" y="22607" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="147" macro="pier_spl_harbor_01_macro">
      <position x="0" y="22749" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="148" macro="pier_spl_harbor_02_macro">
      <position x="0" y="22855" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="149" macro="pier_spl_harbor_03_macro">
      <position x="0" y="22960" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="150" macro="prod_spl_cheltmeat_macro">
      <position x="0" y="23087" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="151" macro="prod_spl_medicalsupplies_macro">
      <position x="0" y="23204" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="152" macro="prod_spl_scruffinfruit_macro">
      <position x="0" y="23322" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="153" macro="storage_spl_l_container_01_macro">
      <position x="0" y="23557" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="154" macro="storage_spl_m_container_01_macro">
      <position x="0" y="23802" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="155" macro="storage_spl_s_container_01_macro">
      <position x="0" y="23999" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="156" macro="storage_spl_l_liquid_01_macro">
      <position x="0" y="24244" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="157" macro="storage_spl_m_liquid_01_macro">
      <position x="0" y="24488" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="158" macro="storage_spl_s_liquid_01_macro">
      <position x="0" y="24685" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="159" macro="storage_spl_l_solid_01_macro">
      <position x="0" y="24930" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="160" macro="storage_spl_m_solid_01_macro">
      <position x="0" y="25174" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="161" macro="storage_spl_s_solid_01_macro">
      <position x="0" y="25371" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="162" macro="buildmodule_ter_ships_m_dockarea_01_macro">
      <position x="0" y="25516" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="163" macro="buildmodule_ter_ships_l_macro">
      <position x="0" y="25646" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="164" macro="buildmodule_ter_ships_xl_macro">
      <position x="0" y="25735" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="165" macro="struct_ter_base_01_macro">
      <position x="0" y="25815" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="166" macro="struct_ter_base_02_macro">
      <position x="0" y="25895" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="167" macro="struct_ter_base_03_macro">
      <position x="0" y="25975" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="168" macro="struct_ter_cross_01_macro">
      <position x="0" y="26106" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="169" macro="struct_ter_vertical_01_macro">
      <position x="0" y="26203" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="170" macro="struct_ter_vertical_02_macro">
      <position x="0" y="26283" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="171" macro="defence_ter_claim_01_macro">
      <position x="0" y="26363" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="172" macro="defence_ter_disc_01_macro">
      <position x="0" y="26608" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="173" macro="defence_ter_tube_01_macro">
      <position x="0" y="26743" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="174" macro="dockarea_ter_m_station_01_hightech_macro">
      <position x="0" y="26864" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="175" macro="buildmodule_ter_equip_m_dockarea_01_macro">
      <position x="0" y="26985" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="176" macro="buildmodule_ter_equip_l_macro">
      <position x="0" y="27116" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="177" macro="buildmodule_ter_equip_xl_macro">
      <position x="0" y="27205" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="178" macro="hab_ter_l_01_macro">
      <position x="0" y="27669" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="179" macro="hab_ter_m_01_macro">
      <position x="0" y="27968" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="180" macro="hab_ter_s_01_macro">
      <position x="0" y="28199" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="181" macro="pier_ter_harbor_01_macro">
      <position x="0" y="28340" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="182" macro="pier_ter_harbor_02_macro">
      <position x="0" y="28446" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="183" macro="pier_ter_harbor_03_macro">
      <position x="0" y="28552" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="184" macro="pier_ter_harbor_04_macro">
      <position x="0" y="28658" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="185" macro="pier_ter_tradestation_01_macro">
      <position x="0" y="28764" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="186" macro="prod_ter_computronicsubstrate_macro">
      <position x="0" y="28890" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="187" macro="prod_ter_energycells_macro">
      <position x="0" y="29007" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="188" macro="prod_ter_medicalsupplies_macro">
      <position x="0" y="29125" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="189" macro="prod_ter_metallicmicrolattice_macro">
      <position x="0" y="29242" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="190" macro="prod_ter_proteinpaste_macro">
      <position x="0" y="29360" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="191" macro="prod_ter_scrap_recycler_macro">
      <position x="0" y="29477" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="192" macro="prod_ter_siliconcarbide_macro">
      <position x="0" y="29594" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="193" macro="prod_ter_stimulants_macro">
      <position x="0" y="29712" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="194" macro="prod_ter_mre_macro">
      <position x="0" y="29829" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="195" macro="storage_ter_l_container_01_macro">
      <position x="0" y="30065" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="196" macro="storage_ter_m_container_01_macro">
      <position x="0" y="30310" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="197" macro="storage_ter_s_container_01_macro">
      <position x="0" y="30506" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="198" macro="storage_ter_l_liquid_01_macro">
      <position x="0" y="30751" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="199" macro="storage_ter_m_liquid_01_macro">
      <position x="0" y="30996" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="200" macro="storage_ter_s_liquid_01_macro">
      <position x="0" y="31193" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="201" macro="storage_ter_l_solid_01_macro">
      <position x="0" y="31437" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="202" macro="storage_ter_m_solid_01_macro">
      <position x="0" y="31682" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="203" macro="storage_ter_s_solid_01_macro">
      <position x="0" y="31879" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="204" macro="hab_pir_l_01_macro">
      <position x="0" y="32344" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="205" macro="hab_pir_m_01_macro">
      <position x="0" y="32642" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="206" macro="hab_pir_s_01_macro">
      <position x="0" y="32873" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="207" macro="storage_pir_l_condensate_01_macro">
      <position x="0" y="33057" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="208" macro="buildmodule_bor_ships_m_dockarea_01_macro">
      <position x="0" y="33301" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="209" macro="buildmodule_bor_ships_l_macro">
      <position x="0" y="33431" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="210" macro="buildmodule_bor_ships_xl_macro">
      <position x="0" y="33520" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="211" macro="struct_bor_base_01_macro">
      <position x="0" y="33600" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="212" macro="struct_bor_base_02_macro">
      <position x="0" y="33680" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="213" macro="struct_bor_base_03_macro">
      <position x="0" y="33760" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="214" macro="struct_bor_base_04_macro">
      <position x="0" y="33840" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="215" macro="struct_bor_base_05_macro">
      <position x="0" y="33920" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="216" macro="struct_bor_cross_01_macro">
      <position x="0" y="34051" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="217" macro="struct_bor_cross_02_macro">
      <position x="0" y="34165" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="218" macro="struct_bor_vertical_01_macro">
      <position x="0" y="34262" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="219" macro="struct_bor_vertical_02_macro">
      <position x="0" y="34342" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="220" macro="defence_bor_claim_01_macro">
      <position x="0" y="34422" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="221" macro="defence_bor_disc_01_macro">
      <position x="0" y="34667" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="222" macro="defence_bor_tube_01_macro">
      <position x="0" y="34802" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="223" macro="dockarea_bor_m_station_01_standard_macro">
      <position x="0" y="34924" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="224" macro="buildmodule_bor_equip_m_dockarea_01_macro">
      <position x="0" y="35045" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="225" macro="buildmodule_bor_equip_l_macro">
      <position x="0" y="35175" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="226" macro="buildmodule_bor_equip_xl_macro">
      <position x="0" y="35264" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="227" macro="hab_bor_l_01_macro">
      <position x="0" y="35728" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="228" macro="hab_bor_m_01_macro">
      <position x="0" y="36027" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="229" macro="hab_bor_s_01_macro">
      <position x="0" y="36258" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="230" macro="pier_bor_harbor_01_macro">
      <position x="0" y="36400" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="231" macro="pier_bor_harbor_02_macro">
      <position x="0" y="36505" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="232" macro="pier_bor_harbor_03_macro">
      <position x="0" y="36611" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="233" macro="pier_bor_harbor_04_macro">
      <position x="0" y="36717" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="234" macro="pier_bor_tradestation_01_macro">
      <position x="0" y="36823" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="235" macro="prod_bor_bofu_macro">
      <position x="0" y="36949" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="236" macro="prod_bor_bogas_macro">
      <position x="0" y="37067" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="237" macro="prod_bor_medicalsupplies_macro">
      <position x="0" y="37184" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="238" macro="prod_bor_plankton_macro">
      <position x="0" y="37301" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="239" macro="storage_bor_l_container_01_macro">
      <position x="0" y="37537" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="240" macro="storage_bor_m_container_01_macro">
      <position x="0" y="37782" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="241" macro="storage_bor_s_container_01_macro">
      <position x="0" y="37979" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="242" macro="storage_bor_l_liquid_01_macro">
      <position x="0" y="38223" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="243" macro="storage_bor_m_liquid_01_macro">
      <position x="0" y="38468" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="244" macro="storage_bor_s_liquid_01_macro">
      <position x="0" y="38665" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="245" macro="storage_bor_l_solid_01_macro">
      <position x="0" y="38909" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="246" macro="storage_bor_m_solid_01_macro">
      <position x="0" y="39154" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="247" macro="storage_bor_s_solid_01_macro">
      <position x="0" y="39351" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
  </plan>
</plans>`
};