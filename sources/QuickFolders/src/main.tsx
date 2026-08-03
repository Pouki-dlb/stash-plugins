import FolderSelectWithShortcuts from "@components/FolderSelectWithShortcuts";
import { installScanInterceptor } from "@helpers/interceptScans";
import "./styles.scss";

const { PluginApi } = window;
const { React } = PluginApi;

// Observe les tâches lancées sur une sélection de dossiers, où qu'elles soient
// déclenchées, et les consigne dans l'historique.
installScanInterceptor();

PluginApi.patch.instead("FolderSelect", function (props, _, Original) {
  // Sans bouton "+", FolderSelect ne sert pas à composer une liste de dossiers
  // (filtre "Path" des listes, écran de Setup…) : on le laisse intact.
  if (!props.appendButton) {
    return [<Original key="qf-original" {...props} />];
  }

  return [
    <FolderSelectWithShortcuts key="qf-folder-select" {...props} Original={Original} />,
  ];
});
