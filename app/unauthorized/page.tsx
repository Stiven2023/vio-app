import NextLink from "next/link";

import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";

export default function UnauthorizedPage() {
  return (
    <div className="container mx-auto max-w-3xl pt-20 px-6">
      <Card>
        <CardBody>
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-2xl font-semibold text-success">
                Acceso restringido
              </div>
              <div className="text-default-600 mt-2">
                No estas autorizado para ver esta pagina. Si crees que es un
                error, contacta al administrador.
              </div>
            </div>
            <div className="flex gap-2">
              <Button as={NextLink} href="/dashboard" variant="flat">
                Ir al dashboard
              </Button>
              <Button as={NextLink} href="/" variant="flat">
                Ir al inicio
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
