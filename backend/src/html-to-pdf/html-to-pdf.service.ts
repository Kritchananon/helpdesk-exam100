import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { HtmlToPdfDto } from './dto/create-html-to-pdf.dto';

@Injectable()
export class HtmlToPdfService {
  public generateHtmlTemplate(data: HtmlToPdfDto): string {
    const {
      reportNumber,
      reportDate,
      status,
      reporter,
      priority,
      category,
      project,
      issueTitle,
      issueDescription,
      attachmentUrl,
      assignee,
      estimatedCloseDate,
      deadline,
      estimateTime,
      leadTime,
      changeRequest,
      solutionDescription,
      satisfactionRating,
    } = data;

    const rating = parseInt(satisfactionRating) || 0;
    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);

    return `
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>ใบแจ้งซ่อม / ใบรับแจ้งปัญหา</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800&display=swap');
    
    @page { 
      size: A4; 
      margin: 0;
    }
    
    * {
      box-sizing: border-box;
      font-family: "Sarabun", sans-serif;
    }
    
    body {
      font-size: 11px;
      line-height: 1.3;
      color: #000;
      margin: 0;
      padding: 0;
    }
    
    .page {
      padding: 0.5in;
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }
    
    .header-left {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    
    .logo img {
      width: 80px;
      height: 80px;
      object-fit: contain;
    }

    .title-group h1 {
      font-size: 16px;
      font-weight: 500;
      margin: 0;
    }
    
    .title-group .subtitle {
      font-size: 11px;
      margin: 0;
    }
    
    .header-right {
      text-align: right;
      font-size: 10px;
    }
    
    .header-right p {
      margin: 0;
    }
    
    .status-badge {
      background: #C6EFCE;
      color: #006100;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 9px;
      font-weight: bold;
      display: inline-block;
      margin-top: 3px;
    }

    .info-table {
      width: 100%;
      font-size: 11px;
      table-layout: fixed; /* คุมความกว้างของคอลัมน์ */
      border-spacing: 6px;
    }

    .info-table td {
      background-color: #e9eff9;
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
      width: 50%;          /* บังคับให้แต่ละช่องกว้างครึ่งหนึ่ง */
      height: 50px;        /* กำหนดความสูงขั้นต่ำ */
      border-radius: 8px; /* ทำขอบมน */
    }

    .info-table .label {
      font-weight: 500;
      display: block; /* Make the label a block element for a new line */
      margin-bottom: 3px;
    }

    .info-table .value {
      font-weight: normal;
    }

    .section-title {
      font-weight: 600;
      font-size: 12px;
      margin-top: 25px;
      margin-bottom: 5px;
    }
    
    .issue-details {
      background-color: #e9eff9;    /* พื้นหลังสีเดียวกับ info-table */
      padding: 15px;
      font-size: 11px;
      border-radius: 8px;           /* มุมมนเหมือนกัน */
    }
    
    .issue-details p {
      margin: 0 0 5px 0;
    }
    
    .issue-details strong {
      font-weight: 600;
    }

    .attachment-box {
      width: 80px;
      height: 80px;
      border: 1px solid #ccc;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border-radius: 8px;
      margin-top: 5px;
      background-color: white;
    }

    .attachment-box img {
      width: 100%;
      height: 100%;
      object-fit: cover; /* หรือ contain ถ้าอยากให้เห็นทั้งภาพ */
    }
    
    .solution-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    
    .solution-table th, .solution-table td {
      border-bottom: 1px solid #e9e8e8ff;
      padding: 8px 10px;
      text-align: left;
    }
    
    .solution-table th {
      font-weight: 500;
    }
    
    .rating-section {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .stars {
      color: #FFD700;
      font-size: 16px;
    }
    
    .rating-number {
      font-size: 12px;
    }
    
    .footer {
      border-top: 1px solid #e9e8e8ff;
      margin-top: 20px;
      padding-top: 10px;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
    }
    .attachment-container {
      display: flex;
      flex-wrap: wrap;       /* ถ้ามีหลายรูปจะขึ้นบรรทัดใหม่อัตโนมัติ */
      gap: 10px;             /* ระยะห่างระหว่างรูป */
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header-top">
      <div class="header-left">
        <div class="logo">
          <img src="https://khontamweb.com/images/khontamweb_logo-01.png" alt="Logo">
        </div>
        <div class="title-group">
          <h1>ใบแจ้งซ่อม / ใบรับแจ้งปัญหา</h1>
          <div class="subtitle">ระบบรับแจ้งปัญหา</div>
          <div class="subtitle">(Helpdesk Support System)</div>
        </div>
      </div>
      <div class="header-right">
        <p>เลขที่: <strong>${reportNumber}</strong></p>
        <p>วันที่แจ้ง: ${reportDate}</p>
        <span class="status-badge">สถานะ: ${status}</span>
      </div>
    </div>

    <table class="info-table">
      <tbody>
        <tr>
          <td><span class="label">ผู้แจ้ง:</span><span class="value">${reporter}</span></td>
          <td><span class="label">ความเร่งด่วน / Priority:</span><span class="value">${priority}</span></td>
        </tr>
        <tr>
          <td><span class="label">หมวดหมู่:</span><span class="value">${category}</span></td>
          <td><span class="label">Project:</span><span class="value">${project}</span></td>
        </tr>
      </tbody>
    </table>
    
    <div class="section-title">รายละเอียดปัญหา</div>
    <div class="issue-details">
      <p><strong>หัวข้อ:</strong> ${issueTitle}</p>
      <p><strong>คำอธิบาย:</strong> ${issueDescription}</p>
      <p>
        <strong>Attachment:</strong><br/>
        ${(attachmentUrl && attachmentUrl.length)
        ? `<div class="attachment-container">
        ${attachmentUrl
          .map(
            url => `
              <div class="attachment-box">
                <img src="${url}" alt="Attachment" />
              </div>`
          )
          .join('')}
      </div>`
        : 'ไม่พบไฟล์แนบ (Error 404 Not Found)'
      }

      </p>
    </div>

    <div class="section-title">ข้อมูลการติดตาม / การแก้ไข</div>
    <table class="solution-table">
      <tbody>
        <tr>
          <th>ผู้รับผิดชอบ</th>
          <td>${assignee} (ทีมสนับสนุน)</td>
        </tr>
        <tr>
          <th>วันปิดงานโดยประมาณ</th>
          <td>${estimatedCloseDate}</td>
        </tr>
        <tr>
          <th>กำหนดส่งงาน</th>
          <td>${deadline}</td>
        </tr>
        <tr>
          <th>Estimate time</th>
          <td>${estimateTime}</td>
        </tr>
        <tr>
          <th>Lead Time</th>
          <td>${leadTime}</td>
        </tr>
        <tr>
          <th>Change Request</th>
          <td>${changeRequest}</td>
        </tr>
        <tr>
          <th>คำอธิบายการแก้ไข</th>
          <td>${solutionDescription}</td>
        </tr>
      </tbody>
    </table>
    
    <div class="section-title">ผลการประเมินความพึงพอใจ</div>
    <div class="rating-section">
      <span class="stars">${stars}</span>
      <span class="rating-number">${rating} / 5</span>
    </div>

    <div class="footer">
      <div>ผู้แจ้ง: <strong>${reporter}</strong></div>
      <div>พิมพ์โดยระบบ | วันที่บันทึก ${reportDate}</div>
    </div>
  </div>
</body>
</html>
    `;
  }

  async generatePdf(data: HtmlToPdfDto): Promise<Buffer> {
    let browser: puppeteer.Browser | null = null;

    try {
      const htmlContent = this.generateHtmlTemplate(data);

      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--disable-extensions',
        ],
      });

      const page = await browser.newPage();

      await page.setContent(htmlContent, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '0.5in',
          right: '0.5in',
          bottom: '0.5in',
          left: '0.5in',
        },
        printBackground: true,
        preferCSSPageSize: true,
      });

      return Buffer.from(pdfBuffer);

    } catch (error) {
      throw new HttpException(
        `Error generating PDF: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}