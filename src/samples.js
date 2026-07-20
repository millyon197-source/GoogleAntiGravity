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
      <position x="0" y="0" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="2" macro="struct_arg_base_02_macro">
      <position x="0" y="110" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="3" macro="struct_arg_base_03_macro">
      <position x="0" y="220" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="4" macro="struct_arg_cross_01_macro">
      <position x="0" y="381" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="5" macro="struct_arg_vertical_01_macro">
      <position x="0" y="508" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="6" macro="struct_arg_vertical_02_macro">
      <position x="0" y="618" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="7" macro="defence_arg_claim_01_macro">
      <position x="0" y="728" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="8" macro="defence_arg_disc_01_macro">
      <position x="0" y="1003" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="9" macro="defence_arg_tube_01_macro">
      <position x="0" y="1168" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="10" macro="dockarea_arg_m_station_01_macro">
      <position x="0" y="1340" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="11" macro="dockarea_arg_m_station_01_hightech_macro">
      <position x="0" y="1532" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="12" macro="dockarea_arg_m_station_01_lowtech_macro">
      <position x="0" y="1724" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="13" macro="dockarea_arg_m_station_02_macro">
      <position x="0" y="1916" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="14" macro="dockarea_arg_m_station_02_hightech_macro">
      <position x="0" y="2108" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="15" macro="dockarea_arg_m_station_02_lowtech_macro">
      <position x="0" y="2301" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="16" macro="dockarea_arg_m_02_tradestation_01_macro">
      <position x="0" y="2493" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="17" macro="hab_arg_l_01_macro">
      <position x="0" y="3008" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="18" macro="hab_arg_m_01_macro">
      <position x="0" y="3517" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="19" macro="hab_arg_s_01_macro">
      <position x="0" y="3901" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="20" macro="pier_arg_harbor_01_macro">
      <position x="0" y="4111" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="21" macro="pier_arg_harbor_02_macro">
      <position x="0" y="4273" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="22" macro="pier_arg_harbor_03_macro">
      <position x="0" y="4434" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="23" macro="prod_arg_foodrations_macro">
      <position x="0" y="4613" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="24" macro="prod_arg_meat_macro">
      <position x="0" y="4798" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="25" macro="prod_arg_medicalsupplies_macro">
      <position x="0" y="4983" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="26" macro="prod_arg_spacefuel_macro">
      <position x="0" y="5168" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="27" macro="prod_arg_wheat_macro">
      <position x="0" y="5352" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="28" macro="storage_arg_l_container_01_macro">
      <position x="0" y="5728" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="29" macro="storage_arg_m_container_01_macro">
      <position x="0" y="6096" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="30" macro="storage_arg_s_container_01_macro">
      <position x="0" y="6361" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="31" macro="storage_arg_l_liquid_01_macro">
      <position x="0" y="6751" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="32" macro="storage_arg_m_liquid_01_macro">
      <position x="0" y="7119" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="33" macro="storage_arg_s_liquid_01_macro">
      <position x="0" y="7384" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="34" macro="storage_arg_l_solid_01_macro">
      <position x="0" y="7774" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="35" macro="storage_arg_m_solid_01_macro">
      <position x="0" y="8141" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="36" macro="storage_arg_s_solid_01_macro">
      <position x="0" y="8407" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="37" macro="buildmodule_gen_ships_m_dockarea_01_macro">
      <position x="0" y="8612" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="38" macro="buildmodule_gen_ships_l_macro">
      <position x="0" y="8769" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="39" macro="buildmodule_gen_ships_xl_macro">
      <position x="0" y="8888" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="40" macro="buildmodule_gen_equip_m_dockarea_01_macro">
      <position x="0" y="9060" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="41" macro="buildmodule_gen_equip_l_macro">
      <position x="0" y="9217" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="42" macro="buildmodule_gen_equip_xl_macro">
      <position x="0" y="9336" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="43" macro="proc_gen_scrapworks_macro">
      <position x="0" y="9446" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="44" macro="prod_gen_advancedcomposites_macro">
      <position x="0" y="9612" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="45" macro="prod_gen_advancedelectronics_macro">
      <position x="0" y="9797" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="46" macro="prod_gen_antimattercells_macro">
      <position x="0" y="9982" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="47" macro="prod_gen_antimatterconverters_macro">
      <position x="0" y="10167" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="48" macro="prod_gen_claytronics_macro">
      <position x="0" y="10352" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="49" macro="prod_gen_dronecomponents_macro">
      <position x="0" y="10536" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="50" macro="prod_gen_energycells_macro">
      <position x="0" y="10721" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="51" macro="prod_gen_engineparts_macro">
      <position x="0" y="10906" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="52" macro="prod_gen_fieldcoils_macro">
      <position x="0" y="11091" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="53" macro="prod_gen_graphene_macro">
      <position x="0" y="11276" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="54" macro="prod_gen_hullparts_macro">
      <position x="0" y="11460" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="55" macro="prod_gen_microchips_macro">
      <position x="0" y="11645" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="56" macro="prod_gen_missilecomponents_macro">
      <position x="0" y="11830" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="57" macro="prod_gen_plasmaconductors_macro">
      <position x="0" y="12015" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="58" macro="prod_gen_quantumtubes_macro">
      <position x="0" y="12200" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="59" macro="prod_gen_refinedmetals_macro">
      <position x="0" y="12384" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="60" macro="prod_gen_scanningarrays_macro">
      <position x="0" y="12569" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="61" macro="prod_gen_scrap_recycler_macro">
      <position x="0" y="12754" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="62" macro="prod_gen_shieldcomponents_macro">
      <position x="0" y="12939" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="63" macro="prod_gen_siliconwafers_macro">
      <position x="0" y="13124" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="64" macro="prod_gen_smartchips_macro">
      <position x="0" y="13308" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="65" macro="prod_gen_spices_macro">
      <position x="0" y="13493" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="66" macro="prod_gen_superfluidcoolant_macro">
      <position x="0" y="13678" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="67" macro="prod_gen_turretcomponents_macro">
      <position x="0" y="13863" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="68" macro="prod_gen_water_macro">
      <position x="0" y="14048" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="69" macro="prod_gen_weaponcomponents_macro">
      <position x="0" y="14232" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="70" macro="struct_par_base_01_macro">
      <position x="0" y="14361" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="71" macro="struct_par_base_02_macro">
      <position x="0" y="14471" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="72" macro="struct_par_base_03_macro">
      <position x="0" y="14581" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="73" macro="struct_par_cross_01_macro">
      <position x="0" y="14742" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="74" macro="struct_par_cross_02_macro">
      <position x="0" y="14920" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="75" macro="struct_par_cross_03_macro">
      <position x="0" y="15098" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="76" macro="struct_par_vertical_01_macro">
      <position x="0" y="15225" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="77" macro="struct_par_vertical_02_macro">
      <position x="0" y="15335" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="78" macro="defence_par_claim_01_macro">
      <position x="0" y="15445" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="79" macro="defence_par_disc_01_macro">
      <position x="0" y="15720" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="80" macro="defence_par_tube_01_macro">
      <position x="0" y="15885" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="81" macro="hab_par_l_01_macro">
      <position x="0" y="16380" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="82" macro="hab_par_m_01_macro">
      <position x="0" y="16888" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="83" macro="hab_par_s_01_macro">
      <position x="0" y="17272" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="84" macro="pier_par_harbor_01_macro">
      <position x="0" y="17483" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="85" macro="pier_par_harbor_02_macro">
      <position x="0" y="17644" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="86" macro="pier_par_harbor_03_macro">
      <position x="0" y="17806" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="87" macro="prod_par_majadust_macro">
      <position x="0" y="17985" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="88" macro="prod_par_majasnails_macro">
      <position x="0" y="18170" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="89" macro="prod_par_medicalsupplies_macro">
      <position x="0" y="18354" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="90" macro="prod_par_sojabeans_macro">
      <position x="0" y="18539" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="91" macro="prod_par_sojahusk_macro">
      <position x="0" y="18724" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="92" macro="storage_par_l_container_01_macro">
      <position x="0" y="19100" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="93" macro="storage_par_m_container_01_macro">
      <position x="0" y="19467" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="94" macro="storage_par_s_container_01_macro">
      <position x="0" y="19733" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="95" macro="storage_par_l_liquid_01_macro">
      <position x="0" y="20123" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="96" macro="storage_par_m_liquid_01_macro">
      <position x="0" y="20490" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="97" macro="storage_par_s_liquid_01_macro">
      <position x="0" y="20756" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="98" macro="storage_par_l_solid_01_macro">
      <position x="0" y="21146" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="99" macro="storage_par_m_solid_01_macro">
      <position x="0" y="21513" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="100" macro="storage_par_s_solid_01_macro">
      <position x="0" y="21779" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="101" macro="struct_tel_base_01_macro">
      <position x="0" y="21922" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="102" macro="struct_tel_base_02_macro">
      <position x="0" y="22032" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="103" macro="struct_tel_base_03_macro">
      <position x="0" y="22142" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="104" macro="struct_tel_cross_01_macro">
      <position x="0" y="22303" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="105" macro="struct_tel_vertical_01_macro">
      <position x="0" y="22430" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="106" macro="struct_tel_vertical_02_macro">
      <position x="0" y="22540" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="107" macro="defence_tel_claim_01_macro">
      <position x="0" y="22650" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="108" macro="defence_tel_disc_01_macro">
      <position x="0" y="22925" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="109" macro="defence_tel_tube_01_macro">
      <position x="0" y="23090" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="110" macro="hab_tel_l_01_macro">
      <position x="0" y="23584" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="111" macro="hab_tel_m_01_macro">
      <position x="0" y="24093" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="112" macro="hab_tel_s_01_macro">
      <position x="0" y="24477" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="113" macro="pier_tel_harbor_01_macro">
      <position x="0" y="24687" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="114" macro="pier_tel_harbor_02_macro">
      <position x="0" y="24849" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="115" macro="pier_tel_harbor_03_macro">
      <position x="0" y="25010" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="116" macro="prod_tel_advancedcomposites_macro">
      <position x="0" y="25189" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="117" macro="prod_tel_engineparts_macro">
      <position x="0" y="25374" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="118" macro="prod_tel_hullparts_macro">
      <position x="0" y="25559" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="119" macro="prod_tel_medicalsupplies_macro">
      <position x="0" y="25744" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="120" macro="prod_tel_nostropoil_macro">
      <position x="0" y="25928" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="121" macro="prod_tel_scanningarrays_macro">
      <position x="0" y="26113" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="122" macro="prod_tel_spaceweed_macro">
      <position x="0" y="26298" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="123" macro="prod_tel_sunriseflowers_macro">
      <position x="0" y="26483" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="124" macro="prod_tel_swampplant_macro">
      <position x="0" y="26668" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="125" macro="prod_tel_teladianium_macro">
      <position x="0" y="26852" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="126" macro="storage_tel_l_container_01_macro">
      <position x="0" y="27228" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="127" macro="storage_tel_m_container_01_macro">
      <position x="0" y="27596" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="128" macro="storage_tel_s_container_01_macro">
      <position x="0" y="27862" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="129" macro="storage_tel_l_liquid_01_macro">
      <position x="0" y="28251" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="130" macro="storage_tel_m_liquid_01_macro">
      <position x="0" y="28619" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="131" macro="storage_tel_s_liquid_01_macro">
      <position x="0" y="28885" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="132" macro="storage_tel_l_solid_01_macro">
      <position x="0" y="29274" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="133" macro="storage_tel_m_solid_01_macro">
      <position x="0" y="29642" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="134" macro="storage_tel_s_solid_01_macro">
      <position x="0" y="29908" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="135" macro="struct_spl_base_01_macro">
      <position x="0" y="30050" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="136" macro="struct_spl_base_02_macro">
      <position x="0" y="30160" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="137" macro="struct_spl_base_03_macro">
      <position x="0" y="30270" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="138" macro="struct_spl_cross_01_macro">
      <position x="0" y="30431" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="139" macro="struct_spl_vertical_01_macro">
      <position x="0" y="30558" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="140" macro="struct_spl_vertical_02_macro">
      <position x="0" y="30668" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="141" macro="defence_spl_claim_01_macro">
      <position x="0" y="30778" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="142" macro="defence_spl_disc_01_macro">
      <position x="0" y="31053" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="143" macro="defence_spl_tube_01_macro">
      <position x="0" y="31218" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="144" macro="hab_spl_l_01_macro">
      <position x="0" y="31713" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="145" macro="hab_spl_m_01_macro">
      <position x="0" y="32221" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="146" macro="hab_spl_s_01_macro">
      <position x="0" y="32605" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="147" macro="pier_spl_harbor_01_macro">
      <position x="0" y="32816" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="148" macro="pier_spl_harbor_02_macro">
      <position x="0" y="32977" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="149" macro="pier_spl_harbor_03_macro">
      <position x="0" y="33139" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="150" macro="prod_spl_cheltmeat_macro">
      <position x="0" y="33318" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="151" macro="prod_spl_medicalsupplies_macro">
      <position x="0" y="33503" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="152" macro="prod_spl_scruffinfruit_macro">
      <position x="0" y="33687" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="153" macro="storage_spl_l_container_01_macro">
      <position x="0" y="34063" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="154" macro="storage_spl_m_container_01_macro">
      <position x="0" y="34431" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="155" macro="storage_spl_s_container_01_macro">
      <position x="0" y="34697" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="156" macro="storage_spl_l_liquid_01_macro">
      <position x="0" y="35086" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="157" macro="storage_spl_m_liquid_01_macro">
      <position x="0" y="35454" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="158" macro="storage_spl_s_liquid_01_macro">
      <position x="0" y="35719" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="159" macro="storage_spl_l_solid_01_macro">
      <position x="0" y="36109" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="160" macro="storage_spl_m_solid_01_macro">
      <position x="0" y="36477" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="161" macro="storage_spl_s_solid_01_macro">
      <position x="0" y="36742" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="162" macro="buildmodule_ter_ships_m_dockarea_01_macro">
      <position x="0" y="36947" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="163" macro="buildmodule_ter_ships_l_macro">
      <position x="0" y="37104" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="164" macro="buildmodule_ter_ships_xl_macro">
      <position x="0" y="37223" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="165" macro="struct_ter_base_01_macro">
      <position x="0" y="37333" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="166" macro="struct_ter_base_02_macro">
      <position x="0" y="37443" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="167" macro="struct_ter_base_03_macro">
      <position x="0" y="37553" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="168" macro="struct_ter_cross_01_macro">
      <position x="0" y="37714" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="169" macro="struct_ter_vertical_01_macro">
      <position x="0" y="37841" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="170" macro="struct_ter_vertical_02_macro">
      <position x="0" y="37951" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="171" macro="defence_ter_claim_01_macro">
      <position x="0" y="38061" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="172" macro="defence_ter_disc_01_macro">
      <position x="0" y="38336" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="173" macro="defence_ter_tube_01_macro">
      <position x="0" y="38501" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="174" macro="dockarea_ter_m_station_01_hightech_macro">
      <position x="0" y="38673" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="175" macro="buildmodule_ter_equip_m_dockarea_01_macro">
      <position x="0" y="38865" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="176" macro="buildmodule_ter_equip_l_macro">
      <position x="0" y="39023" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="177" macro="buildmodule_ter_equip_xl_macro">
      <position x="0" y="39142" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="178" macro="hab_ter_l_01_macro">
      <position x="0" y="39636" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="179" macro="hab_ter_m_01_macro">
      <position x="0" y="40145" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="180" macro="hab_ter_s_01_macro">
      <position x="0" y="40529" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="181" macro="pier_ter_harbor_01_macro">
      <position x="0" y="40739" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="182" macro="pier_ter_harbor_02_macro">
      <position x="0" y="40901" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="183" macro="pier_ter_harbor_03_macro">
      <position x="0" y="41062" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="184" macro="pier_ter_harbor_04_macro">
      <position x="0" y="41224" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="185" macro="pier_ter_tradestation_01_macro">
      <position x="0" y="41385" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="186" macro="prod_ter_computronicsubstrate_macro">
      <position x="0" y="41564" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="187" macro="prod_ter_energycells_macro">
      <position x="0" y="41749" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="188" macro="prod_ter_medicalsupplies_macro">
      <position x="0" y="41934" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="189" macro="prod_ter_metallicmicrolattice_macro">
      <position x="0" y="42119" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="190" macro="prod_ter_proteinpaste_macro">
      <position x="0" y="42304" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="191" macro="prod_ter_scrap_recycler_macro">
      <position x="0" y="42488" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="192" macro="prod_ter_siliconcarbide_macro">
      <position x="0" y="42673" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="193" macro="prod_ter_stimulants_macro">
      <position x="0" y="42858" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="194" macro="prod_ter_mre_macro">
      <position x="0" y="43043" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="195" macro="storage_ter_l_container_01_macro">
      <position x="0" y="43419" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="196" macro="storage_ter_m_container_01_macro">
      <position x="0" y="43786" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="197" macro="storage_ter_s_container_01_macro">
      <position x="0" y="44052" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="198" macro="storage_ter_l_liquid_01_macro">
      <position x="0" y="44442" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="199" macro="storage_ter_m_liquid_01_macro">
      <position x="0" y="44809" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="200" macro="storage_ter_s_liquid_01_macro">
      <position x="0" y="45075" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="201" macro="storage_ter_l_solid_01_macro">
      <position x="0" y="45464" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="202" macro="storage_ter_m_solid_01_macro">
      <position x="0" y="45832" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="203" macro="storage_ter_s_solid_01_macro">
      <position x="0" y="46098" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="204" macro="hab_pir_l_01_macro">
      <position x="0" y="46625" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="205" macro="hab_pir_m_01_macro">
      <position x="0" y="47134" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="206" macro="hab_pir_s_01_macro">
      <position x="0" y="47518" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="207" macro="storage_pir_l_condensate_01_macro">
      <position x="0" y="47936" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="208" macro="buildmodule_bor_ships_m_dockarea_01_macro">
      <position x="0" y="48190" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="209" macro="buildmodule_bor_ships_l_macro">
      <position x="0" y="48348" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="210" macro="buildmodule_bor_ships_xl_macro">
      <position x="0" y="48467" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="211" macro="struct_bor_base_01_macro">
      <position x="0" y="48577" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="212" macro="struct_bor_base_02_macro">
      <position x="0" y="48687" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="213" macro="struct_bor_base_03_macro">
      <position x="0" y="48797" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="214" macro="struct_bor_base_04_macro">
      <position x="0" y="48907" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="215" macro="struct_bor_base_05_macro">
      <position x="0" y="49017" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="216" macro="struct_bor_cross_01_macro">
      <position x="0" y="49178" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="217" macro="struct_bor_cross_02_macro">
      <position x="0" y="49356" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="218" macro="struct_bor_vertical_01_macro">
      <position x="0" y="49483" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="219" macro="struct_bor_vertical_02_macro">
      <position x="0" y="49593" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="220" macro="defence_bor_claim_01_macro">
      <position x="0" y="49703" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="221" macro="defence_bor_disc_01_macro">
      <position x="0" y="49978" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="222" macro="defence_bor_tube_01_macro">
      <position x="0" y="50143" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="223" macro="dockarea_bor_m_station_01_standard_macro">
      <position x="0" y="50314" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="224" macro="buildmodule_bor_equip_m_dockarea_01_macro">
      <position x="0" y="50507" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="225" macro="buildmodule_bor_equip_l_macro">
      <position x="0" y="50664" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="226" macro="buildmodule_bor_equip_xl_macro">
      <position x="0" y="50783" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="227" macro="hab_bor_l_01_macro">
      <position x="0" y="51278" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="228" macro="hab_bor_m_01_macro">
      <position x="0" y="51786" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="229" macro="hab_bor_s_01_macro">
      <position x="0" y="52171" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="230" macro="pier_bor_harbor_01_macro">
      <position x="0" y="52381" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="231" macro="pier_bor_harbor_02_macro">
      <position x="0" y="52542" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="232" macro="pier_bor_harbor_03_macro">
      <position x="0" y="52704" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="233" macro="pier_bor_harbor_04_macro">
      <position x="0" y="52866" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="234" macro="pier_bor_tradestation_01_macro">
      <position x="0" y="53027" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="235" macro="prod_bor_bofu_macro">
      <position x="0" y="53206" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="236" macro="prod_bor_bogas_macro">
      <position x="0" y="53391" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="237" macro="prod_bor_medicalsupplies_macro">
      <position x="0" y="53576" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="238" macro="prod_bor_plankton_macro">
      <position x="0" y="53761" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="239" macro="storage_bor_l_container_01_macro">
      <position x="0" y="54136" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="240" macro="storage_bor_m_container_01_macro">
      <position x="0" y="54504" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="241" macro="storage_bor_s_container_01_macro">
      <position x="0" y="54770" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="242" macro="storage_bor_l_liquid_01_macro">
      <position x="0" y="55159" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="243" macro="storage_bor_m_liquid_01_macro">
      <position x="0" y="55527" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="244" macro="storage_bor_s_liquid_01_macro">
      <position x="0" y="55793" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="245" macro="storage_bor_l_solid_01_macro">
      <position x="0" y="56182" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="246" macro="storage_bor_m_solid_01_macro">
      <position x="0" y="56550" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="247" macro="storage_bor_s_solid_01_macro">
      <position x="0" y="56816" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
  </plan>
</plans>`
};
