import { putTender } from './db.mjs'
export function seedDemo(db) {
  const samples = [
    [
      'Diseño y desarrollo de portal de atención ciudadana',
      'Municipalidad de Viña del Mar',
      'Valparaíso',
      'Viña del Mar',
      3,
      18500000,
      'Diseño web accesible, desarrollo de software y mantención de un portal con formularios y seguimiento de solicitudes.',
    ],
    [
      'Capacitación en inteligencia artificial aplicada a pymes',
      'Servicio de Cooperación Técnica',
      'Metropolitana de Santiago',
      'Santiago',
      7,
      9600000,
      'Curso de capacitación y talleres de inteligencia artificial para equipos comerciales.',
    ],
    [
      'Soporte y mantención de plataforma institucional',
      'Universidad Regional',
      'Valparaíso',
      'Valparaíso',
      1,
      24000000,
      'Soporte de software, respaldos y mantención de sitio web institucional por doce meses.',
    ],
    [
      'Implementación de sistema de reservas deportivas',
      'Municipalidad de Quilpué',
      'Valparaíso',
      'Quilpué',
      5,
      12800000,
      'Desarrollo de software para reservas y administración de recintos deportivos.',
    ],
    [
      'Servicio de aseo para oficinas administrativas',
      'Dirección Regional de Servicios',
      'Metropolitana de Santiago',
      'Santiago',
      12,
      42000000,
      'Aseo de oficinas y provisión de insumos de limpieza.',
    ],
    [
      'Diseño de identidad y comunicación digital',
      'Corporación Cultural Regional',
      'Biobío',
      'Concepción',
      10,
      null,
      'Diseño gráfico, comunicación y actualización de sitio web cultural.',
    ],
    [
      'Adquisición de equipamiento de redes',
      'Instituto Tecnológico',
      'Metropolitana de Santiago',
      'Santiago',
      4,
      32000000,
      'Compra e instalación de switches y equipamiento informático.',
    ],
    [
      'Talleres de programación para emprendedores',
      'Centro de Desarrollo Local',
      'Valparaíso',
      'Quillota',
      15,
      7800000,
      'Capacitación en programación, desarrollo web y herramientas digitales.',
    ],
  ]
  samples.forEach(
    ([title, buyer, region, commune, days, amount, description], index) => {
      const id = `DEMO-${index + 1}`
      if (
        db
          .prepare('SELECT 1 FROM tenders WHERE id=? AND source=?')
          .get(id, 'demo')
      )
        return
      const stamp = Date.now()
      putTender(
        db,
        {
          id,
          title,
          buyer,
          region,
          commune,
          amount,
          description,
          currency: 'CLP',
          type: 'LE',
          status: 'open',
          closesAt: new Date(stamp + days * 86400000).toISOString(),
          publishedAt: new Date(stamp - 86400000).toISOString(),
          questionsUntil: new Date(stamp + days * 43200000).toISOString(),
          answersAt: null,
          items: [
            {
              name: title,
              description,
              quantity: '1',
              unit: 'Servicio',
              category: 'Servicios',
            },
          ],
          detailed: true,
          fetchedAt: new Date().toISOString(),
          officialUrl: null,
        },
        'demo',
      )
    },
  )
}
