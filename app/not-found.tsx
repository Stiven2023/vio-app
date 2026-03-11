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
              <div className="text-2xl font-semibold">Page not found</div>
              <div className="text-default-600 mt-2">
                The route you are trying to open does not exist or was moved.
              </div>
            </div>
            <div className="flex gap-2">
              <Button as={NextLink} href="/" variant="flat">
                Go to home
              </Button>
              <Button as={NextLink} href="/erp/dashboard" variant="flat">
                Go to dashboard
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
