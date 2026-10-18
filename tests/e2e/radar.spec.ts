import { test, expect } from '@playwright/test'
test('full flow: profile, discovery, persistent tracking, note, alert and export', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/#radar-de-pegas')
  await page
    .getByLabel('Correo electrónico')
    .fill(`${testInfo.project.name}@example.test`)
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('test-only-password-1234')
  await page.getByRole('button', { name: 'Ingresar a mi radar' }).click()
  await expect(
    page.getByRole('heading', { name: 'Menos ruido. Mejores oportunidades.' }),
  ).toBeVisible()
  await expect(
    page.getByText(
      'Todos los organismos, montos y oportunidades son ejemplos ficticios.',
    ),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Perfil comercial' }).click()
  await page.getByLabel('Nombre comercial').fill('ExpressWebsite')
  await page
    .getByLabel('Servicios o palabras clave')
    .fill('software, desarrollo, capacitación')
  await page.getByLabel('Excluir oportunidades que contengan').fill('aseo')
  await page.getByRole('button', { name: 'Guardar perfil' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Perfil comercial actualizado',
  )
  await page.getByRole('button', { name: 'Descubrir', exact: true }).click()
  await page.getByLabel('Buscar oportunidades').fill('portal')
  await expect(
    page.getByRole('heading', {
      name: 'Diseño y desarrollo de portal de atención ciudadana',
    }),
  ).toBeVisible()
  await page
    .getByRole('heading', {
      name: 'Diseño y desarrollo de portal de atención ciudadana',
    })
    .click()
  const dialog = page.getByRole('dialog')
  await expect(
    dialog.getByRole('heading', {
      name: 'Diseño y desarrollo de portal de atención ciudadana',
    }),
  ).toBeVisible()
  await dialog
    .getByRole('button', { name: 'Guardar oportunidad', exact: true })
    .click()
  await expect(dialog.getByLabel('Etapa', { exact: true })).toBeVisible()
  await dialog.getByLabel('Etapa', { exact: true }).selectOption('preparing')
  await dialog.getByLabel('Responsable', { exact: true }).fill('Aldo')
  await dialog.getByLabel('Nueva tarea').fill('Revisar anexo técnico')
  await dialog.getByRole('button', { name: 'Añadir', exact: true }).click()
  await dialog.getByRole('button', { name: 'Guardar seguimiento' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Seguimiento actualizado',
  )
  await dialog
    .getByLabel('Nota del equipo')
    .fill('Revisar requisitos antes de ofertar.')
  await dialog.getByRole('button', { name: 'Registrar nota' }).click()
  await expect(
    dialog.getByText('Revisar requisitos antes de ofertar.', { exact: true }),
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Cerrar detalle' }).click()
  await page.reload()
  await page
    .getByRole('button', { name: 'Mi seguimiento', exact: true })
    .click()
  await expect(
    page.locator('.rp-stage-chip').filter({ hasText: 'Preparando oferta' }),
  ).toBeVisible()
  await page
    .getByRole('heading', {
      name: 'Diseño y desarrollo de portal de atención ciudadana',
    })
    .click()
  await expect(dialog.getByLabel('Responsable', { exact: true })).toHaveValue(
    'Aldo',
  )
  await expect(
    dialog.getByText('Revisar anexo técnico', { exact: true }),
  ).toBeVisible()
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true)
  await page.screenshot({
    path: `test-results/radar-detail-${testInfo.project.name}.png`,
    fullPage: false,
  })
  await dialog.getByRole('button', { name: 'Cerrar detalle' }).click()
  await page.getByRole('button', { name: 'Descubrir', exact: true }).click()
  await page.getByLabel('Buscar oportunidades').fill('software')
  await page.getByRole('button', { name: 'Crear alerta', exact: true }).click()
  await page.getByLabel('Nombre de la búsqueda').fill('Software ExpressWebsite')
  await page
    .getByRole('button', { name: 'Guardar búsqueda y activar alerta' })
    .click()
  await expect(page.getByRole('status')).toContainText('Búsqueda guardada')
  await page.getByRole('button', { name: /Búsquedas y alertas/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Software ExpressWebsite' }),
  ).toBeVisible()
  await expect(page.locator('.rp-notification').first()).toBeVisible()
  await page.getByRole('button', { name: 'Descubrir', exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar CSV' }).click()
  expect((await downloadPromise).suggestedFilename()).toBe('radar-de-pegas.csv')
  await page.screenshot({
    path: `test-results/radar-dashboard-${testInfo.project.name}.png`,
    fullPage: true,
  })
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true)
  expect(errors).toEqual([])
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Vamos por esa oportunidad.' }),
  ).toBeVisible()
})
