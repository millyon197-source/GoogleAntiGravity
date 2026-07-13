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
</plans>`
};
