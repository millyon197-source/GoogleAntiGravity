/**
 * Pre-loaded X4 Station Construction Plan XML samples.
 */

export const SAMPLES = {
  refineryComplex: `<?xml version="1.0" encoding="UTF-8"?>
<plans>
  <plan id="refinery_loop_arg" name="Argon Refining Complex" description="Self-sustaining mid-scale refinery loop producing Refined Metals and Graphene. Includes Solar Arrays, Gas/Solid/Container storage, Argon L Habitat Ring, and structural scaffolding.">
    <!-- Central Dock and Hub -->
    <entry index="1" macro="dockarea_arg_l_station_01_macro">
      <position x="0" y="0" z="0"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="2" macro="struct_arg_cross_01_macro">
      <position x="0" y="0" z="120"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    
    <!-- Habitat / Crew Quarters -->
    <entry index="3" macro="struct_arg_straight_02_macro">
      <position x="0" y="0" z="220"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="4" macro="hab_arg_l_01_macro">
      <position x="0" y="0" z="320"/>
      <rotation yaw="0" pitch="90" roll="0"/>
    </entry>
    
    <!-- Cargo Storage System (Left Arm) -->
    <entry index="5" macro="struct_arg_straight_01_macro">
      <position x="-100" y="0" z="120"/>
      <rotation yaw="90" pitch="0" roll="0"/>
    </entry>
    <entry index="6" macro="struct_arg_cross_02_macro">
      <position x="-200" y="0" z="120"/>
      <rotation yaw="90" pitch="0" roll="0"/>
    </entry>
    <entry index="7" macro="storage_arg_l_container_01_macro">
      <position x="-200" y="0" z="220"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="8" macro="storage_arg_l_solid_01_macro">
      <position x="-300" y="0" z="120"/>
      <rotation yaw="90" pitch="0" roll="0"/>
    </entry>
    <entry index="9" macro="storage_arg_l_liquid_01_macro">
      <position x="-200" y="0" z="20"/>
      <rotation yaw="-90" pitch="0" roll="0"/>
    </entry>

    <!-- Energy and Factories (Right Arm) -->
    <entry index="10" macro="struct_arg_straight_01_macro">
      <position x="100" y="0" z="120"/>
      <rotation yaw="-90" pitch="0" roll="0"/>
    </entry>
    <entry index="11" macro="struct_arg_cross_02_macro">
      <position x="200" y="0" z="120"/>
      <rotation yaw="-90" pitch="0" roll="0"/>
    </entry>
    
    <!-- Solar Panels -->
    <entry index="12" macro="prod_gen_energycells_macro">
      <position x="200" y="100" z="120"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    <entry index="13" macro="prod_gen_energycells_macro">
      <position x="200" y="-100" z="120"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    
    <!-- Production Plants -->
    <entry index="14" macro="prod_arg_refinedmetals_macro">
      <position x="320" y="0" z="120"/>
      <rotation yaw="-90" pitch="0" roll="0"/>
    </entry>
    <entry index="15" macro="prod_arg_graphene_macro">
      <position x="200" y="0" z="240"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>

    <!-- Outward Defenses -->
    <entry index="16" macro="struct_arg_tower_01_macro">
      <position x="0" y="120" z="120"/>
      <rotation yaw="0" pitch="0" roll="90"/>
    </entry>
    <entry index="17" macro="defense_arg_disc_01_macro">
      <position x="0" y="220" z="120"/>
      <rotation yaw="0" pitch="0" roll="0"/>
    </entry>
    
    <entry index="18" macro="struct_arg_tower_01_macro">
      <position x="0" y="-120" z="120"/>
      <rotation yaw="0" pitch="0" roll="-90"/>
    </entry>
    <entry index="19" macro="defense_arg_disc_01_macro">
      <position x="0" y="-220" z="120"/>
      <rotation yaw="0" pitch="0" roll="0"/>
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
