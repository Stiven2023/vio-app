import NextLink from "next/link";

import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";

export default function NotFound() {
  return (
    <div className="container mx-auto max-w-3xl pt-20 px-6">
      <Card>
        <CardBody>
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-2xl font-semibold">Pagina no encontrada</div>
              <div className="text-default-600 mt-2">
                La ruta que intentas abrir no existe o fue movida.
              </div>
            </div>
            <div className="flex gap-2">
              <Button as={NextLink} href="/" variant="flat">
                Ir al inicio
              </Button>
              <Button as={NextLink} href="/dashboard" variant="flat">
                Ir al dashboard
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
