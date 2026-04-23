import { FecConnector } from "@/lib/scrapers/connectors/fec";
import { GoogleCivicConnector } from "@/lib/scrapers/connectors/google-civic";
import { OfficialHouseConnector } from "@/lib/scrapers/connectors/official-house";
import { OfficialSenateConnector } from "@/lib/scrapers/connectors/official-senate";
import { OpenSecretsConnector } from "@/lib/scrapers/connectors/opensecrets";
import { ProPublicaConnector } from "@/lib/scrapers/connectors/propublica";
import { StateLocalConnector } from "@/lib/scrapers/connectors/state-local";
import type { CivicDataProvider } from "@/lib/scrapers/types";

export function createSourceConnectors(): CivicDataProvider[] {
  return [
    new OfficialHouseConnector(),
    new OfficialSenateConnector(),
    new FecConnector(),
    new ProPublicaConnector(),
    new StateLocalConnector(),
    new GoogleCivicConnector(),
    new OpenSecretsConnector()
  ];
}
