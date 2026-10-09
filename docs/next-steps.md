# Next playable milestones

1. Install the test APK on the actual MatePad. Check launch, landscape orientation, simultaneous movement/guard, audio, switching away and returning, and a complete match. Record the exact model, OS version, crashes, and measured frame rate. This is the remaining device validation, not a prerequisite to further game development.
2. Replace the painted tiger cutout with a skinned 3D model viewed from the side. Validate untextured idle, forward/back steps and one punch for planted feet, body rotation and joint deformation before final fur/armor work. See [motion and model research](motion-and-model-research.md) for verified findings, source links and the remaining gameplay-reference study. Preserve combat authority and hit/stamina behavior during renderer changes.
3. Give each animal its own move data, recovery timings, reach, and special mechanics. Separate move data from the current shared combat state machine.
4. Add training mode with an inactive/guarding bot, attack timing indicators, hitbox visualization, and a stamina display tutorial.
5. Test new players, adjust touchscreen button placement to the tablet, and tune AI difficulty and combat balance.

The first release scope remains two fighters and one arena until combat feel, native device performance, and art direction have been validated. Online play, campaign production, additional characters, and store publishing are later milestones.
